/**
 * Tests for the calendar and yearly-chart endpoints (defined in friends.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// In-memory store (same pattern as friends.test.ts)
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
// Mocks — mirrors the full drizzle-orm + @workspace/db mock from friends.test.ts
// ---------------------------------------------------------------------------
vi.mock("drizzle-orm", () => {
  type Col = { __name: string };
  const eq = (col: Col, val: unknown): Pred => ({ __pred: (row) => row[col.__name] === val });
  const and = (...ps: unknown[]): Pred => ({
    __pred: (row) => ps.every((p) => (isPred(p) ? p.__pred(row) : true)),
  });
  const or = (...ps: unknown[]): Pred => ({
    __pred: (row) => ps.some((p) => (isPred(p) ? p.__pred(row) : false)),
  });
  const inArray = (col: Col, arr: unknown[]): Pred => ({
    __pred: (row) => arr.includes(row[col.__name]),
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
  return { eq, and, or, inArray, gte, lte, sql };
});

vi.mock("@workspace/db", () => {
  const pawplayUsersTable = makeTable("pawplay_users", ["id", "replitId", "displayName", "email", "inviteCode", "expoPushToken", "createdAt"]);
  const dogsTable = makeTable("dogs", ["id", "userId"]);
  const friendshipsTable = makeTable("friendships", ["userId", "friendId", "createdAt"]);
  const sessionsRecordTable = makeTable("sessions_record", [
    "id", "dogId", "userId", "mode", "difficulty", "rawScore",
    "participationPoints", "bonuses", "commandsUsed", "durationSeconds",
    "completed", "createdAt",
  ]);
  const commandsTable = makeTable("commands", ["id", "dogId", "name", "level"]);

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
          onConflictDoNothing() { return Promise.resolve(); },
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

  return {
    db, pawplayUsersTable, dogsTable, friendshipsTable,
    sessionsRecordTable, commandsTable,
    achievementsTable: makeTable("achievements", []),
    pushTokensTable: makeTable("push_tokens", []),
    usersTable: makeTable("auth_users", []),
    sessionsTable: makeTable("auth_sessions", []),
  };
});

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------
interface AuthedUser { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null }

async function buildApp(opts: { user?: AuthedUser | null } = {}): Promise<Express> {
  const { default: friendsRouter } = await import("./friends");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const u = opts.user ?? null;
    (req as unknown as { user: AuthedUser | null }).user = u;
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated = () => u != null;
    (req as unknown as { log: { error: (...a: unknown[]) => void } }).log = { error: () => {} };
    next();
  });
  app.use("/api", friendsRouter);
  return app;
}

function user(id: string): AuthedUser {
  return { id, email: `${id}@test.com`, firstName: id, lastName: null, profileImageUrl: null };
}

function makeSession(userId: string, dateStr: string, overrides: Record<string, unknown> = {}): Row {
  return {
    id: crypto.randomBytes(4).toString("hex"),
    userId, dogId: "d1",
    createdAt: new Date(dateStr),
    participationPoints: 10,
    durationSeconds: 300,
    ...overrides,
  };
}

beforeEach(() => {
  for (const k of Array.from(stores.keys())) stores.set(k, []);
});

// ---------------------------------------------------------------------------
// GET /api/calendar
// ---------------------------------------------------------------------------
describe("GET /api/calendar", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/calendar");
    expect(res.status).toBe(401);
  });

  it("returns 400 when month or year query params are missing", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/calendar?month=4");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/month and year/i);
  });

  it("returns a day-by-day breakdown for the requested month", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "sessions_record" }).push(
      makeSession("alice", "2025-04-05T12:00:00.000Z"),
      makeSession("alice", "2025-04-05T14:00:00.000Z"),
    );

    const res = await request(app).get("/api/calendar?month=4&year=2025");
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(30);
    const april5 = res.body.days.find((d: { date: string }) => d.date === "2025-04-05");
    expect(april5).toBeDefined();
    expect(april5.sessionCount).toBe(2);
    expect(april5.trainedByMe).toBe(true);
  });

  it("aggregates totalSessions and totalHours correctly", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "sessions_record" }).push(
      makeSession("alice", "2025-04-10T12:00:00.000Z", { durationSeconds: 3600 }),
      makeSession("alice", "2025-04-15T12:00:00.000Z", { durationSeconds: 1800 }),
    );

    const res = await request(app).get("/api/calendar?month=4&year=2025");
    expect(res.status).toBe(200);
    expect(res.body.totalSessions).toBe(2);
    expect(res.body.totalHours).toBeCloseTo(1.5, 2);
  });

  it("marks days where a friend trained as trainedByFriends", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "pawplay_users" }).push(
      { id: "alice", displayName: "Alice", inviteCode: "AAA111" },
      { id: "bob", displayName: "Bob", inviteCode: "BBB222" },
    );
    getStore({ __table: "friendships" }).push({ userId: "alice", friendId: "bob" });
    getStore({ __table: "sessions_record" }).push(
      makeSession("bob", "2025-04-10T12:00:00.000Z"),
    );

    const res = await request(app).get("/api/calendar?month=4&year=2025");
    expect(res.status).toBe(200);
    const april10 = res.body.days.find((d: { date: string }) => d.date === "2025-04-10");
    expect(april10.trainedByFriends).toBe(true);
    expect(april10.trainedByMe).toBe(false);
  });

  it("excludes sessions from non-friend users", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "sessions_record" }).push(
      makeSession("carol", "2025-04-10T12:00:00.000Z"),
    );

    const res = await request(app).get("/api/calendar?month=4&year=2025");
    expect(res.status).toBe(200);
    const april10 = res.body.days.find((d: { date: string }) => d.date === "2025-04-10");
    expect(april10.sessionCount).toBe(0);
  });

  it("returns avgScore of 0 when there are no sessions", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/calendar?month=4&year=2025");
    expect(res.status).toBe(200);
    expect(res.body.avgScore).toBe(0);
    expect(res.body.totalSessions).toBe(0);
    expect(res.body.totalHours).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/yearly-chart
// ---------------------------------------------------------------------------
describe("GET /api/yearly-chart", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/yearly-chart");
    expect(res.status).toBe(401);
  });

  it("returns 400 when year query param is missing", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/yearly-chart");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/year/i);
  });

  it("returns 12 monthly entries for the requested year", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/yearly-chart?year=2025");
    expect(res.status).toBe(200);
    expect(res.body.months).toHaveLength(12);
    expect(res.body.months[0].month).toBe(1);
    expect(res.body.months[11].month).toBe(12);
  });

  it("aggregates hours and sessions per month", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "sessions_record" }).push(
      makeSession("alice", "2025-03-10T12:00:00.000Z", { durationSeconds: 3600 }),
      makeSession("alice", "2025-03-20T12:00:00.000Z", { durationSeconds: 1800 }),
      makeSession("alice", "2025-07-01T12:00:00.000Z", { durationSeconds: 7200 }),
    );

    const res = await request(app).get("/api/yearly-chart?year=2025");
    expect(res.status).toBe(200);

    const march = res.body.months.find((m: { month: number }) => m.month === 3);
    expect(march.sessions).toBe(2);
    expect(march.hours).toBeCloseTo(1.5, 2);

    const july = res.body.months.find((m: { month: number }) => m.month === 7);
    expect(july.sessions).toBe(1);
    expect(july.hours).toBeCloseTo(2.0, 2);
  });

  it("sets bestMonth to the month with the most hours", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "sessions_record" }).push(
      makeSession("alice", "2025-01-15T12:00:00.000Z", { durationSeconds: 1800 }),
      makeSession("alice", "2025-06-15T12:00:00.000Z", { durationSeconds: 7200 }),
    );

    const res = await request(app).get("/api/yearly-chart?year=2025");
    expect(res.status).toBe(200);
    expect(res.body.bestMonth).toBe("June");
  });

  it("sets bestMonth to null when there are no sessions", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/yearly-chart?year=2025");
    expect(res.status).toBe(200);
    expect(res.body.bestMonth).toBeNull();
    expect(res.body.totalHours).toBe(0);
  });

  it("includes friend sessions in the yearly chart", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "pawplay_users" }).push(
      { id: "alice", displayName: "Alice", inviteCode: "AAA111" },
      { id: "bob", displayName: "Bob", inviteCode: "BBB222" },
    );
    getStore({ __table: "friendships" }).push({ userId: "alice", friendId: "bob" });
    getStore({ __table: "sessions_record" }).push(
      makeSession("bob", "2025-02-14T12:00:00.000Z", { durationSeconds: 3600 }),
    );

    const res = await request(app).get("/api/yearly-chart?year=2025");
    const feb = res.body.months.find((m: { month: number }) => m.month === 2);
    expect(feb.sessions).toBe(1);
    expect(feb.hours).toBeCloseTo(1.0, 2);
  });
});
