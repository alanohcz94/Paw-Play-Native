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
  return { eq, and };
});

vi.mock("@workspace/db", () => {
  const dogsTable = makeTable("dogs", ["id", "userId", "name"]);
  const commandsTable = makeTable("commands", [
    "id", "dogId", "name", "level",
    "trainingSessionsCount", "qbSuccessesCount", "qbSessionsWithSuccess",
    "blitzSuccessesCount", "lastUsedAt", "addedAt",
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

  const db = {
    select: (_proj?: unknown) => makeSelectBuilder(),
    insert: makeInsertBuilder,
    delete: makeDeleteBuilder,
    update: makeUpdateBuilder,
  };

  return { db, dogsTable, commandsTable };
});

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------
interface AuthedUser { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null }

async function buildApp(opts: { user?: AuthedUser | null } = {}): Promise<Express> {
  const { default: commandsRouter } = await import("./commands");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const u = opts.user ?? null;
    (req as unknown as { user: AuthedUser | null }).user = u;
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated = () => u != null;
    (req as unknown as { log: { error: (...a: unknown[]) => void } }).log = { error: () => {} };
    next();
  });
  app.use("/api", commandsRouter);
  return app;
}

function user(id: string): AuthedUser {
  return { id, email: `${id}@test.com`, firstName: id, lastName: null, profileImageUrl: null };
}

function seedDog(dogId: string, userId: string) {
  getStore({ __table: "dogs" }).push({ id: dogId, userId, name: "Dog" });
}

function seedCommand(dogId: string, commandId: string, name: string, overrides: Record<string, unknown> = {}) {
  getStore({ __table: "commands" }).push({
    id: commandId, dogId, name, level: 1,
    trainingSessionsCount: 0, qbSuccessesCount: 0,
    qbSessionsWithSuccess: 0, blitzSuccessesCount: 0,
    lastUsedAt: null, addedAt: new Date().toISOString(),
    ...overrides,
  });
}

beforeEach(() => {
  for (const k of Array.from(stores.keys())) stores.set(k, []);
});

// ---------------------------------------------------------------------------
// GET /api/dogs/:dogId/commands
// ---------------------------------------------------------------------------
describe("GET /api/dogs/:dogId/commands", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/dogs/d1/commands");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the dog does not belong to the caller", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d2", "bob");
    const res = await request(app).get("/api/dogs/d2/commands");
    expect(res.status).toBe(404);
  });

  it("returns the dog's commands as an array", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "c1", "Sit");
    seedCommand("d1", "c2", "Stay");
    const res = await request(app).get("/api/dogs/d1/commands");
    expect(res.status).toBe(200);
    expect(res.body.commands).toHaveLength(2);
    expect(res.body.commands.map((c: { name: string }) => c.name)).toContain("Sit");
  });

  it("returns an empty array when the dog has no commands", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    const res = await request(app).get("/api/dogs/d1/commands");
    expect(res.status).toBe(200);
    expect(res.body.commands).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/dogs/:dogId/commands
// ---------------------------------------------------------------------------
describe("POST /api/dogs/:dogId/commands", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/dogs/d1/commands").send({ name: "Sit" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the dog does not belong to the caller", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d2", "bob");
    const res = await request(app).post("/api/dogs/d2/commands").send({ name: "Sit" });
    expect(res.status).toBe(404);
    expect(getStore({ __table: "commands" })).toHaveLength(0);
  });

  it("returns 400 when name is missing", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    const res = await request(app).post("/api/dogs/d1/commands").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it("creates and returns the command at level 1", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    const res = await request(app).post("/api/dogs/d1/commands").send({ name: "Sit" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Sit");
    expect(res.body.level).toBe(1);
    expect(res.body.dogId).toBe("d1");
  });

  it("returns 409 when the command already exists for that dog", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "c1", "Sit");
    const res = await request(app).post("/api/dogs/d1/commands").send({ name: "Sit" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("allows the same command name on a different dog", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedDog("d3", "alice");
    seedCommand("d1", "c1", "Sit");
    const res = await request(app).post("/api/dogs/d3/commands").send({ name: "Sit" });
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/dogs/:dogId/commands/:commandId
// ---------------------------------------------------------------------------
describe("DELETE /api/dogs/:dogId/commands/:commandId", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).delete("/api/dogs/d1/commands/c1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the dog does not belong to the caller", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d2", "bob");
    const res = await request(app).delete("/api/dogs/d2/commands/c1");
    expect(res.status).toBe(404);
  });

  it("returns 404 when the command does not exist", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    const res = await request(app).delete("/api/dogs/d1/commands/nonexistent");
    expect(res.status).toBe(404);
  });

  it("deletes the command and returns success", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "c1", "Sit");
    const res = await request(app).delete("/api/dogs/d1/commands/c1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(getStore({ __table: "commands" })).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/commands/:dogId/:name
// ---------------------------------------------------------------------------
describe("PATCH /api/commands/:dogId/:name", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).patch("/api/commands/d1/Sit").send({ level: 2 });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the dog does not belong to the caller", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d2", "bob");
    const res = await request(app).patch("/api/commands/d2/Sit").send({ level: 2 });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the command does not exist", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    const res = await request(app).patch("/api/commands/d1/NonExistent").send({ level: 2 });
    expect(res.status).toBe(404);
  });

  it("updates command stats and returns the updated command", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "c1", "Sit");
    const res = await request(app).patch("/api/commands/d1/Sit").send({
      level: 2,
      trainingSessionsCount: 5,
      qbSuccessesCount: 3,
    });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe(2);
    expect(res.body.trainingSessionsCount).toBe(5);
    expect(res.body.qbSuccessesCount).toBe(3);
    expect(res.body.lastUsedAt).toBeDefined();
  });

  it("only updates the provided fields", async () => {
    const app = await buildApp({ user: user("alice") });
    seedDog("d1", "alice");
    seedCommand("d1", "c1", "Sit", { level: 1, trainingSessionsCount: 3 });
    const res = await request(app).patch("/api/commands/d1/Sit").send({ level: 2 });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe(2);
    expect(res.body.trainingSessionsCount).toBe(3);
  });
});
