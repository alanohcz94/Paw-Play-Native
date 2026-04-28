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
  const or = (...ps: unknown[]): Pred => ({
    __pred: (row) => ps.some((p) => (isPred(p) ? p.__pred(row) : false)),
  });
  const and = (...ps: unknown[]): Pred => ({
    __pred: (row) => ps.every((p) => (isPred(p) ? p.__pred(row) : true)),
  });
  const inArray = (col: Col, arr: unknown[]): Pred => ({
    __pred: (row) => arr.includes(row[col.__name]),
  });
  const sql = (..._args: unknown[]) => ({ __sql: true });
  return { eq, or, and, inArray, sql };
});

vi.mock("../lib/auth", () => ({
  deleteSession: vi.fn(async () => {}),
  getSessionId: vi.fn(() => undefined),
}));

vi.mock("@workspace/db", () => {
  const pawplayUsersTable = makeTable("pawplay_users", ["id", "replitId", "displayName", "email", "inviteCode", "expoPushToken", "createdAt"]);
  const pushTokensTable = makeTable("push_tokens", ["userId", "expoPushToken", "platform", "updatedAt"]);
  const dogsTable = makeTable("dogs", ["id", "userId", "name"]);
  const commandsTable = makeTable("commands", ["id", "dogId", "name"]);
  const sessionsRecordTable = makeTable("sessions_record", ["id", "userId", "dogId"]);
  const achievementsTable = makeTable("achievements", ["id", "userId", "dogId"]);
  const friendshipsTable = makeTable("friendships", ["userId", "friendId"]);
  const usersTable = makeTable("auth_users", ["id"]);
  const sessionsTable = makeTable("auth_sessions", ["sid", "sess"]);

  function makeSelectBuilder(proj?: Record<string, { __name: string }>) {
    let table: { __table: string } | undefined;
    let where: unknown;
    const b = {
      from(t: { __table: string }) { table = t; return b; },
      where(p: unknown) { where = p; return b; },
      limit(_n: number) { return b; },
      orderBy(_x: unknown) { return b; },
      then<R = Row[], E = never>(onF?: ((v: Row[]) => R | PromiseLike<R>) | null, onR?: ((e: unknown) => E | PromiseLike<E>) | null): PromiseLike<R | E> {
        try {
          let arr = applyWhere(getStore(table!).slice(), where);
          if (proj) {
            arr = arr.map((row) => {
              const out: Row = {};
              for (const [alias, col] of Object.entries(proj)) {
                out[alias] = row[col.__name];
              }
              return out;
            });
          }
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
          onConflictDoUpdate(_opts: unknown) {
            const row = rows[0];
            const existing = getStore(table).find((r) => r.userId === row.userId);
            if (existing) Object.assign(existing, row);
            return { then<T>(onF?: (v: undefined) => T | PromiseLike<T>) { return Promise.resolve(onF ? onF(undefined) : (undefined as never)); } };
          },
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

  // transaction: execute the callback with a proxy of db itself
  const db: Record<string, unknown> = {
    select: (proj?: Record<string, { __name: string }>) => makeSelectBuilder(proj),
    insert: makeInsertBuilder,
    delete: makeDeleteBuilder,
    update: makeUpdateBuilder,
  };
  db.transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(db);

  return {
    db,
    pawplayUsersTable, pushTokensTable, dogsTable,
    commandsTable, sessionsRecordTable, achievementsTable,
    friendshipsTable, usersTable, sessionsTable,
  };
});

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------
interface AuthedUser { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null }

async function buildApp(opts: { user?: AuthedUser | null } = {}): Promise<Express> {
  const { default: usersRouter } = await import("./users");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const u = opts.user ?? null;
    (req as unknown as { user: AuthedUser | null }).user = u;
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated = () => u != null;
    (req as unknown as { log: { error: (...a: unknown[]) => void; warn: (...a: unknown[]) => void } }).log = { error: () => {}, warn: () => {} };
    next();
  });
  app.use("/api", usersRouter);
  return app;
}

function user(id: string): AuthedUser {
  return { id, email: `${id}@test.com`, firstName: id, lastName: null, profileImageUrl: null };
}

function seedUser(id: string, overrides: Record<string, unknown> = {}) {
  getStore({ __table: "pawplay_users" }).push({
    id, email: `${id}@test.com`, displayName: id, inviteCode: "ABC123",
    expoPushToken: null, createdAt: new Date(), ...overrides,
  });
}

beforeEach(() => {
  for (const k of Array.from(stores.keys())) stores.set(k, []);
});

// ---------------------------------------------------------------------------
// GET /api/users/:userId
// ---------------------------------------------------------------------------
describe("GET /api/users/:userId", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/users/alice");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user does not exist in the pawplay table (self)", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/users/alice");
    expect(res.status).toBe(404);
  });

  it("returns the full record when fetching yourself", async () => {
    const app = await buildApp({ user: user("alice") });
    seedUser("alice", {
      displayName: "Alice",
      email: "alice@test.com",
      expoPushToken: "ExponentPushToken[secret]",
      replitId: "replit-alice",
    });
    const res = await request(app).get("/api/users/alice");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("alice");
    expect(res.body.displayName).toBe("Alice");
    expect(res.body.email).toBe("alice@test.com");
    expect(res.body.expoPushToken).toBe("ExponentPushToken[secret]");
    expect(res.body.replitId).toBe("replit-alice");
  });

  it("returns 403 when fetching a stranger (not a friend)", async () => {
    const app = await buildApp({ user: user("alice") });
    seedUser("bob", {
      displayName: "Bob",
      email: "bob@test.com",
      expoPushToken: "ExponentPushToken[bobsecret]",
      replitId: "replit-bob",
    });
    const res = await request(app).get("/api/users/bob");
    expect(res.status).toBe(403);
    expect(res.body.email).toBeUndefined();
    expect(res.body.expoPushToken).toBeUndefined();
    expect(res.body.replitId).toBeUndefined();
  });

  it("returns 403 even when the target user does not exist (no enumeration)", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/users/ghost");
    expect(res.status).toBe(403);
  });

  it("returns only safe public fields when fetching a friend", async () => {
    const app = await buildApp({ user: user("alice") });
    seedUser("bob", {
      displayName: "Bob",
      email: "bob@test.com",
      expoPushToken: "ExponentPushToken[bobsecret]",
      replitId: "replit-bob",
      inviteCode: "BOB123",
    });
    getStore({ __table: "friendships" }).push({ userId: "alice", friendId: "bob" });

    const res = await request(app).get("/api/users/bob");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: "bob",
      displayName: "Bob",
      inviteCode: "BOB123",
    });
    expect(res.body.email).toBeUndefined();
    expect(res.body.expoPushToken).toBeUndefined();
    expect(res.body.replitId).toBeUndefined();
  });

  it("returns 404 when a friend's pawplay row is missing", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "friendships" }).push({ userId: "alice", friendId: "bob" });
    const res = await request(app).get("/api/users/bob");
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/users/:userId
// ---------------------------------------------------------------------------
describe("PATCH /api/users/:userId", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).patch("/api/users/alice").send({ displayName: "X" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when updating another user", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).patch("/api/users/bob").send({ displayName: "Hacked" });
    expect(res.status).toBe(403);
  });

  it("updates displayName and returns the updated user", async () => {
    const app = await buildApp({ user: user("alice") });
    seedUser("alice");
    const res = await request(app).patch("/api/users/alice").send({ displayName: "Alice B" });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Alice B");
  });

  it("returns existing user when no fields are provided", async () => {
    const app = await buildApp({ user: user("alice") });
    seedUser("alice", { displayName: "Alice" });
    const res = await request(app).patch("/api/users/alice").send({});
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/users/:userId/push-token
// ---------------------------------------------------------------------------
describe("PATCH /api/users/:userId/push-token", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).patch("/api/users/alice/push-token").send({ expoPushToken: "ExponentPushToken[abc]" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when registering a token for another user", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).patch("/api/users/bob/push-token").send({ expoPushToken: "ExponentPushToken[abc]" });
    expect(res.status).toBe(403);
  });

  it("stores the push token and returns success", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).patch("/api/users/alice/push-token").send({
      expoPushToken: "ExponentPushToken[abc123]",
      platform: "ios",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/users/:userId
// ---------------------------------------------------------------------------
describe("DELETE /api/users/:userId", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).delete("/api/users/alice");
    expect(res.status).toBe(401);
  });

  it("returns 403 when deleting another user's account", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).delete("/api/users/bob");
    expect(res.status).toBe(403);
  });

  it("deletes the user account and all related data, returning success", async () => {
    const app = await buildApp({ user: user("alice") });
    seedUser("alice");
    getStore({ __table: "dogs" }).push({ id: "d1", userId: "alice", name: "Rex" });
    getStore({ __table: "commands" }).push({ id: "c1", dogId: "d1", name: "Sit" });
    getStore({ __table: "sessions_record" }).push({ id: "s1", userId: "alice", dogId: "d1" });
    getStore({ __table: "friendships" }).push({ userId: "alice", friendId: "bob" });

    const res = await request(app).delete("/api/users/alice");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    expect(getStore({ __table: "pawplay_users" })).toHaveLength(0);
    expect(getStore({ __table: "dogs" })).toHaveLength(0);
    expect(getStore({ __table: "commands" })).toHaveLength(0);
    expect(getStore({ __table: "sessions_record" })).toHaveLength(0);
    expect(getStore({ __table: "friendships" })).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dogs/:dogId/achievements
// ---------------------------------------------------------------------------
describe("GET /api/dogs/:dogId/achievements", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/dogs/d1/achievements");
    expect(res.status).toBe(401);
  });

  it("returns an empty achievements array", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/dogs/d1/achievements");
    expect(res.status).toBe(200);
    expect(res.body.achievements).toEqual([]);
  });
});
