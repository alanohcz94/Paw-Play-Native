import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// In-memory store shared across mock implementations
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
  const and = (...ps: unknown[]): Pred => ({ __pred: (row) => ps.every((p) => (isPred(p) ? p.__pred(row) : true)) });
  return { eq, and };
});

vi.mock("@workspace/db", () => {
  const dogsTable = makeTable("dogs", ["id", "userId", "name", "age", "breed", "avatarUrl", "releaseCue", "markerCue", "level", "xp", "createdAt"]);

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

  return { db, dogsTable };
});

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------
interface AuthedUser { id: string; email: string | null; firstName: string | null; lastName: string | null; profileImageUrl: string | null }

async function buildApp(opts: { user?: AuthedUser | null } = {}): Promise<Express> {
  const { default: dogsRouter } = await import("./dogs");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const u = opts.user ?? null;
    (req as unknown as { user: AuthedUser | null }).user = u;
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated = () => u != null;
    (req as unknown as { log: { error: (...a: unknown[]) => void } }).log = { error: () => {} };
    next();
  });
  app.use("/api", dogsRouter);
  return app;
}

function user(id: string): AuthedUser {
  return { id, email: `${id}@test.com`, firstName: id, lastName: null, profileImageUrl: null };
}

beforeEach(() => {
  for (const k of Array.from(stores.keys())) stores.set(k, []);
});

// ---------------------------------------------------------------------------
// GET /api/users/:userId/dogs
// ---------------------------------------------------------------------------
describe("GET /api/users/:userId/dogs", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/users/alice/dogs");
    expect(res.status).toBe(401);
  });

  it("returns 403 when querying another user's dogs", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/users/bob/dogs");
    expect(res.status).toBe(403);
  });

  it("returns only the caller's own dogs", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "dogs" }).push(
      { id: "d1", userId: "alice", name: "Rex" },
      { id: "d2", userId: "bob", name: "Spot" },
    );
    const res = await request(app).get("/api/users/alice/dogs");
    expect(res.status).toBe(200);
    expect(res.body.dogs).toHaveLength(1);
    expect(res.body.dogs[0].id).toBe("d1");
  });

  it("returns an empty array when the user has no dogs", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/users/alice/dogs");
    expect(res.status).toBe(200);
    expect(res.body.dogs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/dogs
// ---------------------------------------------------------------------------
describe("POST /api/dogs", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/dogs").send({ name: "Rex" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).post("/api/dogs").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it("creates and returns a dog scoped to the caller", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).post("/api/dogs").send({ name: "Buddy", breed: "Lab", age: 2 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Buddy");
    expect(res.body.breed).toBe("Lab");
    expect(res.body.userId).toBe("alice");
    expect(typeof res.body.id).toBe("string");
  });

  it("creates a dog with only a name (optional fields default to null)", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).post("/api/dogs").send({ name: "Max" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Max");
    expect(res.body.age).toBeNull();
    expect(res.body.breed).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /api/dogs/:dogId
// ---------------------------------------------------------------------------
describe("GET /api/dogs/:dogId", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/dogs/d1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the dog does not exist", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).get("/api/dogs/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 403 when the dog belongs to another user", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "dogs" }).push({ id: "d2", userId: "bob", name: "Spot" });
    const res = await request(app).get("/api/dogs/d2");
    expect(res.status).toBe(403);
  });

  it("returns the dog when the caller owns it", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "dogs" }).push({ id: "d1", userId: "alice", name: "Rex" });
    const res = await request(app).get("/api/dogs/d1");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("d1");
    expect(res.body.name).toBe("Rex");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/dogs/:dogId
// ---------------------------------------------------------------------------
describe("PATCH /api/dogs/:dogId", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).patch("/api/dogs/d1").send({ name: "Renamed" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the dog does not exist", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).patch("/api/dogs/nonexistent").send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the dog belongs to another user", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "dogs" }).push({ id: "d2", userId: "bob", name: "Spot" });
    const res = await request(app).patch("/api/dogs/d2").send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });

  it("updates and returns the dog when the caller owns it", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "dogs" }).push({ id: "d1", userId: "alice", name: "Rex", breed: null });
    const res = await request(app).patch("/api/dogs/d1").send({ name: "Rex Jr", breed: "Poodle", markerCue: "Good!" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Rex Jr");
    expect(res.body.breed).toBe("Poodle");
    expect(res.body.markerCue).toBe("Good!");
  });

  it("only updates provided fields, leaving others intact", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "dogs" }).push({ id: "d1", userId: "alice", name: "Rex", breed: "Lab", age: 3 });
    const res = await request(app).patch("/api/dogs/d1").send({ name: "Buddy" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Buddy");
    expect(res.body.breed).toBe("Lab");
    expect(res.body.age).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/dogs/:dogId
// ---------------------------------------------------------------------------
describe("DELETE /api/dogs/:dogId", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).delete("/api/dogs/d1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the dog does not exist", async () => {
    const app = await buildApp({ user: user("alice") });
    const res = await request(app).delete("/api/dogs/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 403 when the dog belongs to another user", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "dogs" }).push({ id: "d2", userId: "bob", name: "Spot" });
    const res = await request(app).delete("/api/dogs/d2");
    expect(res.status).toBe(403);
  });

  it("deletes the dog and returns success", async () => {
    const app = await buildApp({ user: user("alice") });
    getStore({ __table: "dogs" }).push({ id: "d1", userId: "alice", name: "Rex" });
    const res = await request(app).delete("/api/dogs/d1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(getStore({ __table: "dogs" })).toHaveLength(0);
  });
});
