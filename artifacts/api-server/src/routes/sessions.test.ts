import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
interface Row { [key: string]: unknown }
const stores = new Map<string, Row[]>();
function getStore(t: { __table: string }): Row[] {
  if (!stores.has(t.__table)) stores.set(t.__table, []);
  return stores.get(t.__table)!;
}
function setStore(t: { __table: string }, rows: Row[]) {
  stores.set(t.__table, rows);
}
function makeTable(name: string, cols: string[]) {
  const t: Record<string, unknown> & { __table: string } = { __table: name };
  for (const c of cols) t[c] = { __name: c };
  return t;
}
interface Pred { __pred: (row: Row) => boolean }
function isPred(p: unknown): p is Pred {
  return !!p && typeof (p as Pred).__pred === "function";
}
function applyWhere(arr: Row[], w: unknown): Row[] {
  if (!w) return arr;
  if (isPred(w)) return arr.filter(w.__pred);
  return arr;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("drizzle-orm", () => {
  type Col = { __name: string };
  const eq = (col: Col, val: unknown): Pred => ({ __pred: (row) => row[col.__name] === val });
  const and = (...ps: unknown[]): Pred => ({
    __pred: (row) => ps.every((p) => (isPred(p) ? p.__pred(row) : true)),
  });
  const gte = (col: Col, val: unknown): Pred => ({
    __pred: (row) => {
      const v = row[col.__name];
      const a = v instanceof Date ? v : new Date(v as string);
      const b = val instanceof Date ? val : new Date(val as string);
      return a >= b;
    },
  });
  const lte = (col: Col, val: unknown): Pred => ({
    __pred: (row) => {
      const v = row[col.__name];
      const a = v instanceof Date ? v : new Date(v as string);
      const b = val instanceof Date ? val : new Date(val as string);
      return a <= b;
    },
  });
  const sql = (..._args: unknown[]) => ({ __sql: true });
  return { eq, and, gte, lte, sql };
});

vi.mock("@workspace/db", () => {
  const dogsTable = makeTable("dogs", ["id", "userId", "name"]);
  const sessionsRecordTable = makeTable("sessions_record", [
    "id", "dogId", "userId", "mode", "difficulty", "rawScore",
    "participationPoints", "bonuses", "commandsUsed", "durationSeconds",
    "completed", "createdAt",
  ]);
  const commandsTable = makeTable("commands", [
    "id", "dogId", "name", "level", "trainingSessionsCount",
    "qbSuccessesCount", "qbSessionsWithSuccess", "blitzSuccessesCount", "lastUsedAt",
  ]);

  function makeSelectBuilder() {
    let table: { __table: string } | undefined;
    let where: unknown;
    let _limit: number | undefined;
    const b = {
      from(t: { __table: string }) { table = t; return b; },
      where(p: unknown) { where = p; return b; },
      limit(n: number) { _limit = n; return b; },
      orderBy(_x: unknown) { return b; },
      then<R = Row[], E = never>(onF?: ((v: Row[]) => R | PromiseLike<R>) | null, onR?: ((e: unknown) => E | PromiseLike<E>) | null): PromiseLike<R | E> {
        try {
          let arr = applyWhere(getStore(table!).slice(), where);
          if (_limit != null) arr = arr.slice(0, _limit);
          return Promise.resolve(onF ? onF(arr) : (arr as never));
        } catch (e) {
          return Promise.resolve(onR ? onR(e) : (undefined as never));
        }
      },
    };
    return b;
  }

  function makeInsertBuilder(table: { __table: string }) {
    return {
      values(v: Row | Row[]) {
        const rows = (Array.isArray(v) ? v : [v]).map((r) => ({
          ...r, id: r.id ?? crypto.randomBytes(8).toString("hex"), createdAt: r.createdAt ?? new Date(),
        }));
        for (const r of rows) getStore(table).push(r);
        return {
          returning() { return Promise.resolve(rows); },
          then<T>(onF?: (v: undefined) => T | PromiseLike<T>) { return Promise.resolve(onF ? onF(undefined) : (undefined as never)); },
        };
      },
    };
  }

  function makeUpdateBuilder(table: { __table: string }) {
    let setVals: Record<string, unknown> = {};
    const b = {
      set(s: Record<string, unknown>) { setVals = s; return b; },
      where(p: unknown) {
        const matched = applyWhere(getStore(table), p);
        for (const row of matched) Object.assign(row, setVals);
        return {
          returning() { return Promise.resolve(matched); },
          then<T>(onF?: (v: undefined) => T | PromiseLike<T>) { return Promise.resolve(onF ? onF(undefined) : (undefined as never)); },
        };
      },
    };
    return b;
  }

  function makeDeleteBuilder(table: { __table: string }) {
    return {
      where(p: unknown) {
        const arr = getStore(table);
        const removed = applyWhere(arr.slice(), p);
        const s = new Set(removed);
        setStore(table, arr.filter((r) => !s.has(r)));
        return {
          returning() { return Promise.resolve(removed); },
          then<T>(onF?: (v: undefined) => T | PromiseLike<T>) { return Promise.resolve(onF ? onF(undefined) : (undefined as never)); },
        };
      },
    };
  }

  const db = {
    select: (_proj?: unknown) => makeSelectBuilder(),
    insert: makeInsertBuilder,
    update: makeUpdateBuilder,
    delete: makeDeleteBuilder,
  };

  return { db, dogsTable, sessionsRecordTable, commandsTable };
});

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------
interface AuthedUser { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null }

async function buildApp(opts: { user?: AuthedUser | null } = {}): Promise<Express> {
  const { default: sessionsRouter } = await import("./sessions");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const u = opts.user ?? null;
    (req as unknown as { user: AuthedUser | null }).user = u;
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated = () => u != null;
    (req as unknown as { log: { error: (...a: unknown[]) => void } }).log = { error: () => {} };
    next();
  });
  app.use("/api", sessionsRouter);
  return app;
}

function user(id: string): AuthedUser {
  return { id, email: `${id}@test.com`, firstName: id, lastName: null, profileImageUrl: null };
}

function seedDog(dogId: string, userId: string) {
  getStore({ __table: "dogs" }).push({ id: dogId, userId, name: "Dog" });
}

function seedCommand(dogId: string, name: string, overrides: Record<string, unknown> = {}) {
  getStore({ __table: "commands" }).push({
    id: crypto.randomBytes(4).toString("hex"),
    dogId, name, level: 1,
    trainingSessionsCount: 0, qbSuccessesCount: 0,
    qbSessionsWithSuccess: 0, blitzSuccessesCount: 0,
    lastUsedAt: null,
    ...overrides,
  });
}

beforeEach(() => {
  for (const k of Array.from(stores.keys())) stores.set(k, []);
});

// ---------------------------------------------------------------------------
// POST /api/sessions
// ---------------------------------------------------------------------------
describe("POST /api/sessions", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/sessions").send({ dogId: "d1", mode: "training" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when dogId is missing", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).post("/api/sessions").send({ mode: "training" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dogId/i);
  });

  it("returns 400 when mode is missing", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).post("/api/sessions").send({ dogId: "d1" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the dog is not owned by the caller", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d2", "bob");
    const res = await request(app).post("/api/sessions").send({ dogId: "d2", mode: "training" });
    expect(res.status).toBe(404);
    expect(getStore({ __table: "sessions_record" })).toHaveLength(0);
  });

  it("creates and returns a session record", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    const res = await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "training", difficulty: "easy",
      rawScore: 80, participationPoints: 10, durationSeconds: 120, completed: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.dogId).toBe("d1");
    expect(res.body.userId).toBe("alice");
    expect(res.body.mode).toBe("training");
    expect(res.body.participationPoints).toBe(10);
    expect(typeof res.body.id).toBe("string");
  });

  it("stores an incomplete session (completed: false)", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    const res = await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "quickbites", completed: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.completed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Command stat updates on completed sessions
// ---------------------------------------------------------------------------
describe("POST /api/sessions — command stat tracking", () => {
  it("increments trainingSessionsCount after a completed training session", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "Sit", { trainingSessionsCount: 2 });

    await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "training", completed: true,
      commandsUsed: [{ name: "Sit", success: true, count: 2 }],
    });

    const cmd = getStore({ __table: "commands" }).find((c) => c.name === "Sit")!;
    expect(cmd.trainingSessionsCount).toBe(4);
  });

  it("sets command level to 2 after 5 training sessions total", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "Sit", { trainingSessionsCount: 3 });

    await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "training", completed: true,
      commandsUsed: [{ name: "Sit", success: true, count: 2 }],
    });

    const cmd = getStore({ __table: "commands" }).find((c) => c.name === "Sit")!;
    expect(cmd.trainingSessionsCount).toBe(5);
    expect(cmd.level).toBe(2);
  });

  it("increments qbSuccessesCount after a successful quickbites session", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "Sit", { qbSuccessesCount: 4, qbSessionsWithSuccess: 1 });

    await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "quickbites", completed: true,
      commandsUsed: [{ name: "Sit", success: true, count: 3 }],
    });

    const cmd = getStore({ __table: "commands" }).find((c) => c.name === "Sit")!;
    expect(cmd.qbSuccessesCount).toBe(7);
    expect(cmd.qbSessionsWithSuccess).toBe(2);
  });

  it("does not increment qbSuccessesCount when success is false", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "Sit", { qbSuccessesCount: 5 });

    await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "quickbites", completed: true,
      commandsUsed: [{ name: "Sit", success: false, count: 1 }],
    });

    const cmd = getStore({ __table: "commands" }).find((c) => c.name === "Sit")!;
    expect(cmd.qbSuccessesCount).toBe(5);
  });

  it("sets command level to 3 when QB thresholds are met (>=10 successes, >=3 sessions)", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "Sit", { qbSuccessesCount: 8, qbSessionsWithSuccess: 2 });

    await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "quickbites", completed: true,
      commandsUsed: [{ name: "Sit", success: true, count: 2 }],
    });

    const cmd = getStore({ __table: "commands" }).find((c) => c.name === "Sit")!;
    expect(cmd.qbSuccessesCount).toBe(10);
    expect(cmd.qbSessionsWithSuccess).toBe(3);
    expect(cmd.level).toBe(3);
  });

  it("increments blitzSuccessesCount after a successful blitz session", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "Sit", { blitzSuccessesCount: 1 });

    await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "blitz", completed: true,
      commandsUsed: [{ name: "Sit", success: true, count: 3 }],
    });

    const cmd = getStore({ __table: "commands" }).find((c) => c.name === "Sit")!;
    expect(cmd.blitzSuccessesCount).toBe(4);
  });

  it("skips stat update if the command is not found in the db", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");

    const res = await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "training", completed: true,
      commandsUsed: [{ name: "UnknownCmd", success: true, count: 1 }],
    });

    expect(res.status).toBe(201);
    expect(getStore({ __table: "commands" })).toHaveLength(0);
  });

  it("does not update command stats when completed is false", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "Sit", { trainingSessionsCount: 0 });

    await request(app).post("/api/sessions").send({
      dogId: "d1", mode: "training", completed: false,
      commandsUsed: [{ name: "Sit", success: true, count: 5 }],
    });

    const cmd = getStore({ __table: "commands" }).find((c) => c.name === "Sit")!;
    expect(cmd.trainingSessionsCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------
describe("GET /api/sessions", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(401);
  });

  it("returns only the caller's own sessions", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "sessions_record" }).push(
      { id: "s1", userId: "alice", dogId: "d1", createdAt: new Date() },
      { id: "s2", userId: "bob", dogId: "d2", createdAt: new Date() },
    );
    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(200);
    expect(res.body.sessions.map((s: { id: string }) => s.id)).toEqual(["s1"]);
  });

  it("filters by dogId when the dog is owned by the caller", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedDog("d3", "alice");
    getStore({ __table: "sessions_record" }).push(
      { id: "s1", userId: "alice", dogId: "d1", createdAt: new Date() },
      { id: "s2", userId: "alice", dogId: "d3", createdAt: new Date() },
    );
    const res = await request(app).get("/api/sessions?dogId=d1");
    expect(res.status).toBe(200);
    expect(res.body.sessions.map((s: { id: string }) => s.id)).toEqual(["s1"]);
  });

  it("returns empty array when filtering by an unowned dog", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "sessions_record" }).push(
      { id: "s2", userId: "bob", dogId: "d2", createdAt: new Date() },
    );
    const res = await request(app).get("/api/sessions?dogId=d2");
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
  });

  it("returns an empty array when the caller has no sessions", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
  });
});
