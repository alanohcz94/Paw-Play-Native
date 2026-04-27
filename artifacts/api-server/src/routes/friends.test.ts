import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import crypto from "crypto";

interface Row {
  [key: string]: unknown;
}

const stores = new Map<string, Row[]>();

function getStore(table: { __table: string }): Row[] {
  if (!stores.has(table.__table)) stores.set(table.__table, []);
  return stores.get(table.__table)!;
}

function setStore(table: { __table: string }, rows: Row[]) {
  stores.set(table.__table, rows);
}

function makeTable(name: string, cols: string[]) {
  const t: Record<string, unknown> & { __table: string } = { __table: name };
  for (const c of cols) t[c] = { __name: c };
  return t;
}

interface Pred {
  __pred: (row: Row) => boolean;
}
function isPred(p: unknown): p is Pred {
  return !!p && typeof (p as Pred).__pred === "function";
}
function applyWhere(arr: Row[], w: unknown): Row[] {
  if (!w) return arr;
  if (isPred(w)) return arr.filter(w.__pred);
  return arr;
}

vi.mock("drizzle-orm", () => {
  type Col = { __name: string };
  const eq = (col: Col, val: unknown): Pred => ({
    __pred: (row) => row[col.__name] === val,
  });
  const and = (...ps: unknown[]): Pred => ({
    __pred: (row) =>
      ps.every((p) => (isPred(p) ? p.__pred(row) : true)),
  });
  const or = (...ps: unknown[]): Pred => ({
    __pred: (row) =>
      ps.some((p) => (isPred(p) ? p.__pred(row) : false)),
  });
  const inArray = (col: Col, arr: unknown[]): Pred => ({
    __pred: (row) => arr.includes(row[col.__name]),
  });
  const gte = (col: Col, val: unknown): Pred => ({
    __pred: (row) => {
      const v = row[col.__name];
      const d = v instanceof Date ? v : new Date(v as string);
      const dv = val instanceof Date ? val : new Date(val as string);
      return d >= dv;
    },
  });
  const lte = (col: Col, val: unknown): Pred => ({
    __pred: (row) => {
      const v = row[col.__name];
      const d = v instanceof Date ? v : new Date(v as string);
      const dv = val instanceof Date ? val : new Date(val as string);
      return d <= dv;
    },
  });
  const sql = (..._args: unknown[]) => ({ __sql: true });
  return { eq, and, or, inArray, gte, lte, sql };
});

vi.mock("@workspace/db", () => {
  const pawplayUsersTable = makeTable("pawplay_users", [
    "id",
    "replitId",
    "displayName",
    "email",
    "inviteCode",
    "expoPushToken",
    "createdAt",
  ]);
  const dogsTable = makeTable("dogs", [
    "id",
    "userId",
    "name",
    "age",
    "breed",
    "avatarUrl",
    "releaseCue",
    "markerCue",
    "level",
    "xp",
    "createdAt",
  ]);
  const friendshipsTable = makeTable("friendships", [
    "userId",
    "friendId",
    "createdAt",
  ]);
  const sessionsRecordTable = makeTable("sessions_record", [
    "id",
    "dogId",
    "userId",
    "mode",
    "difficulty",
    "rawScore",
    "participationPoints",
    "bonuses",
    "commandsUsed",
    "durationSeconds",
    "completed",
    "createdAt",
  ]);
  const commandsTable = makeTable("commands", [
    "id",
    "dogId",
    "name",
    "level",
    "trainingSessionsCount",
    "qbSuccessesCount",
    "qbSessionsWithSuccess",
    "blitzSuccessesCount",
    "lastUsedAt",
    "addedAt",
  ]);

  function makeSelectBuilder() {
    let table: { __table: string } | undefined;
    let where: unknown;
    let limit: number | undefined;
    const builder = {
      from(t: { __table: string }) {
        table = t;
        return builder;
      },
      where(p: unknown) {
        where = p;
        return builder;
      },
      limit(n: number) {
        limit = n;
        return builder;
      },
      orderBy(_x: unknown) {
        return builder;
      },
      then<TResult1 = Row[], TResult2 = never>(
        onF?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
        onR?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        try {
          let arr = applyWhere(getStore(table!).slice(), where);
          if (limit != null) arr = arr.slice(0, limit);
          return Promise.resolve(onF ? onF(arr) : (arr as never));
        } catch (e) {
          return Promise.resolve(onR ? onR(e) : (undefined as never));
        }
      },
    };
    return builder;
  }

  function makeInsertBuilder(table: { __table: string }) {
    return {
      values(v: Row | Row[]) {
        const values = Array.isArray(v) ? v : [v];
        const insert = (skipConflicts: boolean): Row[] => {
          const inserted: Row[] = [];
          for (const row of values) {
            if (skipConflicts && table.__table === "friendships") {
              const exists = getStore(table).some(
                (r) =>
                  r.userId === row.userId && r.friendId === row.friendId,
              );
              if (exists) continue;
            }
            if (skipConflicts && table.__table === "pawplay_users") {
              const exists = getStore(table).some(
                (r) => r.inviteCode === row.inviteCode,
              );
              if (exists) {
                throw new Error("invite_code unique violation");
              }
            }
            const stored: Row = {
              ...row,
              id:
                row.id ?? crypto.randomBytes(8).toString("hex"),
              createdAt: row.createdAt ?? new Date(),
            };
            getStore(table).push(stored);
            inserted.push(stored);
          }
          return inserted;
        };
        return {
          returning() {
            return Promise.resolve(insert(true));
          },
          onConflictDoNothing() {
            insert(true);
            return Promise.resolve();
          },
          then<T>(onF?: (v: undefined) => T | PromiseLike<T>) {
            insert(false);
            return Promise.resolve(onF ? onF(undefined) : (undefined as never));
          },
        };
      },
    };
  }

  function makeDeleteBuilder(table: { __table: string }) {
    return {
      where(p: unknown) {
        const arr = getStore(table);
        const removed = applyWhere(arr.slice(), p);
        const removedSet = new Set(removed);
        const result = {
          returning() {
            setStore(table, arr.filter((r) => !removedSet.has(r)));
            return Promise.resolve(removed);
          },
          then<T>(onF?: (v: undefined) => T | PromiseLike<T>) {
            setStore(table, arr.filter((r) => !removedSet.has(r)));
            return Promise.resolve(onF ? onF(undefined) : (undefined as never));
          },
        };
        return result;
      },
    };
  }

  function makeUpdateBuilder(table: { __table: string }) {
    let setVals: Record<string, unknown> = {};
    const builder = {
      set(s: Record<string, unknown>) {
        setVals = s;
        return builder;
      },
      where(p: unknown) {
        const arr = getStore(table);
        const matched = applyWhere(arr, p);
        for (const row of matched) Object.assign(row, setVals);
        return {
          returning() {
            return Promise.resolve(matched);
          },
          then<T>(onF?: (v: undefined) => T | PromiseLike<T>) {
            return Promise.resolve(
              onF ? onF(undefined) : (undefined as never),
            );
          },
        };
      },
    };
    return builder;
  }

  const db = {
    insert: makeInsertBuilder,
    select: (_proj?: unknown) => makeSelectBuilder(),
    delete: makeDeleteBuilder,
    update: makeUpdateBuilder,
  };

  return {
    db,
    pawplayUsersTable,
    dogsTable,
    friendshipsTable,
    sessionsRecordTable,
    commandsTable,
    achievementsTable: makeTable("achievements", []),
    pushTokensTable: makeTable("push_tokens", []),
    usersTable: makeTable("users", []),
    sessionsTable: makeTable("sessions", []),
  };
});

interface AuthedUserShape {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

async function buildApp(
  opts: { user?: AuthedUserShape | null } = {},
): Promise<Express> {
  const { default: friendsRouter } = await import("./friends");
  const { default: dogsRouter } = await import("./dogs");
  const { default: sessionsRouter } = await import("./sessions");
  const { default: commandsRouter } = await import("./commands");

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = opts.user ?? null;
    (req as unknown as { user: AuthedUserShape | null }).user = user;
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated =
      () => user != null;
    (
      req as unknown as { log: { error: (...a: unknown[]) => void } }
    ).log = { error: () => {} };
    next();
  });
  app.use("/api", friendsRouter);
  app.use("/api", dogsRouter);
  app.use("/api", sessionsRouter);
  app.use("/api", commandsRouter);
  return app;
}

function userShape(id: string, name = id): AuthedUserShape {
  return {
    id,
    email: `${id}@example.com`,
    firstName: name,
    lastName: null,
    profileImageUrl: null,
  };
}

beforeEach(() => {
  for (const k of Array.from(stores.keys())) stores.set(k, []);
});

describe("GET /api/users/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(401);
  });

  it("lazy-creates a pawplay user with a 6-char invite code on first call", async () => {
    const app = await buildApp({ user: userShape("alice") });
    const res = await request(app).get("/api/users/me");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("alice");
    expect(typeof res.body.inviteCode).toBe("string");
    expect(res.body.inviteCode).toMatch(/^[0-9A-F]{6}$/);
    expect(res.body.displayName).toBe("alice");
    expect(res.body.email).toBe("alice@example.com");
  });

  it("is idempotent: subsequent calls return the same user with the same invite code", async () => {
    const app = await buildApp({ user: userShape("alice") });
    const first = await request(app).get("/api/users/me");
    const second = await request(app).get("/api/users/me");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.inviteCode).toBe(first.body.inviteCode);
    expect(second.body.id).toBe(first.body.id);
  });
});

describe("POST /api/friends", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/friends").send({ code: "ABCDEF" });
    expect(res.status).toBe(401);
  });

  it("rejects invite codes that are not 6 characters", async () => {
    const app = await buildApp({ user: userShape("alice") });
    const res = await request(app).post("/api/friends").send({ code: "ABC" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 characters/i);
  });

  it("returns 404 for an unknown invite code", async () => {
    const app = await buildApp({ user: userShape("alice") });
    const res = await request(app)
      .post("/api/friends")
      .send({ code: "ZZZZZZ" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when trying to add yourself", async () => {
    const app = await buildApp({ user: userShape("alice") });
    const me = await request(app).get("/api/users/me");
    const res = await request(app)
      .post("/api/friends")
      .send({ code: me.body.inviteCode });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/i);
  });

  it("creates a mutual friendship visible from both sides", async () => {
    const aliceApp = await buildApp({ user: userShape("alice") });
    const bobApp = await buildApp({ user: userShape("bob") });

    const bobMe = await request(bobApp).get("/api/users/me");
    const add = await request(aliceApp)
      .post("/api/friends")
      .send({ code: bobMe.body.inviteCode });

    expect(add.status).toBe(201);
    expect(add.body.friend.id).toBe("bob");

    const aliceList = await request(aliceApp).get("/api/friends");
    const bobList = await request(bobApp).get("/api/friends");

    expect(aliceList.status).toBe(200);
    expect(bobList.status).toBe(200);
    expect(aliceList.body.friends.map((f: { id: string }) => f.id)).toEqual([
      "bob",
    ]);
    expect(bobList.body.friends.map((f: { id: string }) => f.id)).toEqual([
      "alice",
    ]);
  });

  it("returns 409 on duplicate add", async () => {
    const aliceApp = await buildApp({ user: userShape("alice") });
    const bobApp = await buildApp({ user: userShape("bob") });

    const bobMe = await request(bobApp).get("/api/users/me");
    await request(aliceApp).post("/api/friends").send({ code: bobMe.body.inviteCode });
    const dup = await request(aliceApp)
      .post("/api/friends")
      .send({ code: bobMe.body.inviteCode });
    expect(dup.status).toBe(409);
  });
});

describe("DELETE /api/friends/:friendId", () => {
  it("removes the friendship in both directions", async () => {
    const aliceApp = await buildApp({ user: userShape("alice") });
    const bobApp = await buildApp({ user: userShape("bob") });

    const bobMe = await request(bobApp).get("/api/users/me");
    await request(aliceApp)
      .post("/api/friends")
      .send({ code: bobMe.body.inviteCode });

    const del = await request(aliceApp).delete("/api/friends/bob");
    expect(del.status).toBe(200);

    const aliceList = await request(aliceApp).get("/api/friends");
    const bobList = await request(bobApp).get("/api/friends");
    expect(aliceList.body.friends).toEqual([]);
    expect(bobList.body.friends).toEqual([]);
  });
});

describe("GET /api/leaderboard", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/leaderboard");
    expect(res.status).toBe(401);
  });

  it("includes the caller and friends, sorted by points descending", async () => {
    const aliceApp = await buildApp({ user: userShape("alice") });
    const bobApp = await buildApp({ user: userShape("bob") });
    const carolApp = await buildApp({ user: userShape("carol") });

    // Alice befriends Bob (mutual). Carol is unrelated.
    const bobMe = await request(bobApp).get("/api/users/me");
    await request(carolApp).get("/api/users/me");
    await request(aliceApp)
      .post("/api/friends")
      .send({ code: bobMe.body.inviteCode });

    // Seed sessions: Alice has 1 session worth 10pts, Bob has 2 sessions worth 30pts total,
    // Carol has 1 session worth 999pts (must NOT appear in Alice's leaderboard).
    getStore({ __table: "sessions_record" }).push(
      { id: "s1", userId: "alice", participationPoints: 10 },
      { id: "s2", userId: "bob", participationPoints: 20 },
      { id: "s3", userId: "bob", participationPoints: 10 },
      { id: "s4", userId: "carol", participationPoints: 999 },
    );

    const res = await request(aliceApp).get("/api/leaderboard");
    expect(res.status).toBe(200);
    const ids = res.body.entries.map((e: { userId: string }) => e.userId);
    expect(ids).toEqual(["bob", "alice"]);
    expect(ids).not.toContain("carol");

    const bob = res.body.entries.find(
      (e: { userId: string }) => e.userId === "bob",
    );
    const alice = res.body.entries.find(
      (e: { userId: string }) => e.userId === "alice",
    );
    expect(bob.totalPoints).toBe(30);
    expect(bob.sessionCount).toBe(2);
    expect(alice.totalPoints).toBe(10);
    expect(alice.sessionCount).toBe(1);
  });
});

describe("Dog ownership scoping", () => {
  it("GET /api/users/:userId/dogs returns 403 when querying another user", async () => {
    const app = await buildApp({ user: userShape("alice") });
    const res = await request(app).get("/api/users/bob/dogs");
    expect(res.status).toBe(403);
  });

  it("GET /api/users/:userId/dogs returns only the caller's dogs", async () => {
    const app = await buildApp({ user: userShape("alice") });
    getStore({ __table: "dogs" }).push(
      { id: "d1", userId: "alice", name: "Rex" },
      { id: "d2", userId: "bob", name: "Spot" },
    );
    const res = await request(app).get("/api/users/alice/dogs");
    expect(res.status).toBe(200);
    expect(res.body.dogs.map((d: { id: string }) => d.id)).toEqual(["d1"]);
  });

  it("GET /api/dogs/:dogId returns 403 when the dog belongs to someone else", async () => {
    const app = await buildApp({ user: userShape("alice") });
    getStore({ __table: "dogs" }).push({
      id: "d2",
      userId: "bob",
      name: "Spot",
    });
    const res = await request(app).get("/api/dogs/d2");
    expect(res.status).toBe(403);
  });

  it("POST /api/dogs scopes the new dog to the caller", async () => {
    const app = await buildApp({ user: userShape("alice") });
    const res = await request(app).post("/api/dogs").send({ name: "Rex" });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe("alice");
    expect(res.body.name).toBe("Rex");
  });
});

describe("Session and command authorization", () => {
  it("POST /api/sessions returns 404 when the dog is not owned by the caller", async () => {
    const app = await buildApp({ user: userShape("alice") });
    getStore({ __table: "dogs" }).push({
      id: "d2",
      userId: "bob",
      name: "Spot",
    });
    const res = await request(app)
      .post("/api/sessions")
      .send({ dogId: "d2", mode: "training" });
    expect(res.status).toBe(404);
    // No session row should have been created for someone else's dog.
    expect(getStore({ __table: "sessions_record" })).toHaveLength(0);
  });

  it("GET /api/sessions only returns the caller's own sessions, never a friend's", async () => {
    const app = await buildApp({ user: userShape("alice") });
    getStore({ __table: "sessions_record" }).push(
      { id: "s1", userId: "alice", dogId: "d1" },
      { id: "s2", userId: "bob", dogId: "d2" },
    );
    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(200);
    expect(res.body.sessions.map((s: { id: string }) => s.id)).toEqual(["s1"]);
  });

  it("POST /api/dogs/:dogId/commands returns 404 when the dog is not owned by the caller", async () => {
    const app = await buildApp({ user: userShape("alice") });
    getStore({ __table: "dogs" }).push({
      id: "d2",
      userId: "bob",
      name: "Spot",
    });
    const res = await request(app)
      .post("/api/dogs/d2/commands")
      .send({ name: "Sit" });
    expect(res.status).toBe(404);
    expect(getStore({ __table: "commands" })).toHaveLength(0);
  });

  it("GET /api/dogs/:dogId/commands returns 404 when the dog is not owned by the caller", async () => {
    const app = await buildApp({ user: userShape("alice") });
    getStore({ __table: "dogs" }).push({
      id: "d2",
      userId: "bob",
      name: "Spot",
    });
    getStore({ __table: "commands" }).push({
      id: "c1",
      dogId: "d2",
      name: "Sit",
    });
    const res = await request(app).get("/api/dogs/d2/commands");
    expect(res.status).toBe(404);
  });
});
