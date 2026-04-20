import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

const insertedUsers: unknown[] = [];
const insertedSessions: { sid: string; sess: unknown }[] = [];
const deleteSessionCalls: number[] = [];

vi.mock("@workspace/db", () => {
  const usersTable = { __name: "users" } as unknown;
  const sessionsTable = { __name: "sessions" } as unknown;

  function makeInsertBuilder(table: unknown) {
    let _values: unknown;
    return {
      values(v: unknown) {
        _values = v;
        const chain: PromiseLike<void> & {
          onConflictDoUpdate: (..._args: unknown[]) => {
            returning: () => Promise<unknown[]>;
          };
        } = {
          onConflictDoUpdate: () => ({
            returning: async () => {
              if (table === usersTable) insertedUsers.push(_values);
              return [_values];
            },
          }),
          then(onFulfilled, onRejected) {
            try {
              if (table === sessionsTable) {
                insertedSessions.push(_values as { sid: string; sess: unknown });
              } else if (table === usersTable) {
                insertedUsers.push(_values);
              }
              return Promise.resolve(
                onFulfilled ? onFulfilled(undefined as never) : (undefined as never),
              );
            } catch (e) {
              return Promise.resolve(
                onRejected ? onRejected(e) : (undefined as never),
              );
            }
          },
        };
        return chain;
      },
    };
  }

  const db = {
    insert: (table: unknown) => makeInsertBuilder(table),
    select: () => ({ from: () => ({ where: async () => [] }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    delete: (table: unknown) => ({
      where: async () => {
        if (table === sessionsTable) deleteSessionCalls.push(Date.now());
      },
    }),
  };

  return { db, usersTable, sessionsTable };
});

const authorizationCodeGrant = vi.fn();

vi.mock("openid-client", () => ({
  discovery: vi.fn(async () => ({}) as unknown),
  randomState: () => "STATE_TEST",
  randomNonce: () => "NONCE_TEST",
  randomPKCECodeVerifier: () => "VERIFIER_TEST",
  calculatePKCECodeChallenge: async () => "CHALLENGE_TEST",
  buildAuthorizationUrl: () =>
    new URL("https://replit.com/oidc/auth?foo=bar"),
  buildEndSessionUrl: () => new URL("https://replit.com/oidc/end"),
  authorizationCodeGrant: (...args: unknown[]) =>
    authorizationCodeGrant(...args),
  refreshTokenGrant: vi.fn(),
}));

process.env.REPL_ID = process.env.REPL_ID ?? "test-repl-id";

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
  const { default: authRouter } = await import("./auth");
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Mimic production app: auth middleware adds isAuthenticated() and a logger.
  app.use((req, _res, next) => {
    const user = opts.user ?? null;
    (req as unknown as { user: AuthedUserShape | null }).user = user;
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated =
      () => user != null;
    (req as unknown as { log: { error: (...a: unknown[]) => void } }).log = {
      error: () => {},
    };
    next();
  });
  app.use("/api", authRouter);
  return app;
}

function getSetCookies(res: request.Response): string[] {
  const raw = res.headers["set-cookie"];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function findCookie(cookies: string[], name: string): string | undefined {
  return cookies.find((c) => c.startsWith(`${name}=`));
}

describe("mobile sign-in flow", () => {
  beforeEach(() => {
    insertedUsers.length = 0;
    insertedSessions.length = 0;
    deleteSessionCalls.length = 0;
    authorizationCodeGrant.mockReset();
  });

  it("rejects an invalid return_scheme on /api/mobile-auth/start", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/mobile-auth/start")
      .query({ return_scheme: "evil://hijack" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid return_scheme" });
    // Must not start an OIDC flow on rejection.
    expect(getSetCookies(res)).toHaveLength(0);
  });

  it("rejects a missing return_scheme on /api/mobile-auth/start", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/mobile-auth/start");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid return_scheme" });
  });

  it("redirects to OIDC and sets the four expected cookies for a valid scheme", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/mobile-auth/start")
      .query({ return_scheme: "pawplay://auth-callback" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://replit.com/oidc/auth?foo=bar");

    const cookies = getSetCookies(res);
    const codeVerifier = findCookie(cookies, "code_verifier");
    const nonce = findCookie(cookies, "nonce");
    const state = findCookie(cookies, "state");
    const mobileScheme = findCookie(cookies, "mobile_return_scheme");

    expect(codeVerifier).toBeDefined();
    expect(nonce).toBeDefined();
    expect(state).toBeDefined();
    expect(mobileScheme).toBeDefined();

    expect(codeVerifier).toContain("VERIFIER_TEST");
    expect(nonce).toContain("NONCE_TEST");
    expect(state).toContain("STATE_TEST");
    expect(mobileScheme).toContain(
      encodeURIComponent("pawplay://auth-callback"),
    );

    // The web-only return_to cookie must NOT be set on the mobile branch.
    expect(findCookie(cookies, "return_to")).toBeUndefined();
  });

  it("clears any stale mobile_return_scheme cookie when /api/login starts a web flow", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/login")
      .set("Cookie", "mobile_return_scheme=pawplay%3A%2F%2Fauth-callback");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://replit.com/oidc/auth?foo=bar");

    const cookies = getSetCookies(res);
    const cleared = findCookie(cookies, "mobile_return_scheme");
    expect(cleared).toBeDefined();
    // express clearCookie uses Expires in the past + empty value.
    expect(cleared).toMatch(/^mobile_return_scheme=;/);
    expect(cleared!.toLowerCase()).toContain("expires=");

    // The web flow still seeds its own cookies.
    expect(findCookie(cookies, "code_verifier")).toBeDefined();
    expect(findCookie(cookies, "state")).toBeDefined();
    expect(findCookie(cookies, "nonce")).toBeDefined();
    expect(findCookie(cookies, "return_to")).toBeDefined();
  });

  it("redirects /api/callback to the mobile deep link with ?token=... when the mobile cookie is present", async () => {
    authorizationCodeGrant.mockResolvedValue({
      access_token: "access_test",
      refresh_token: "refresh_test",
      claims: () => ({
        sub: "user_mobile_123",
        email: "mobile@example.com",
        first_name: "Mo",
        last_name: "Bile",
        picture: null,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      expiresIn: () => 3600,
    });

    const app = await buildApp();
    const res = await request(app)
      .get("/api/callback")
      .query({ code: "AUTH_CODE", state: "STATE_TEST" })
      .set(
        "Cookie",
        [
          "code_verifier=VERIFIER_TEST",
          "nonce=NONCE_TEST",
          "state=STATE_TEST",
          "mobile_return_scheme=pawplay%3A%2F%2Fauth-callback",
        ].join("; "),
      );

    expect(res.status).toBe(302);
    expect(insertedSessions).toHaveLength(1);
    const sid = insertedSessions[0].sid;
    expect(typeof sid).toBe("string");
    expect(sid.length).toBeGreaterThan(0);
    expect(res.headers.location).toBe(
      `pawplay://auth-callback?token=${encodeURIComponent(sid)}`,
    );

    // The session cookie must NOT be set on the mobile branch — the deep link
    // is the only credential delivery channel.
    const cookies = getSetCookies(res);
    expect(findCookie(cookies, "sid")).toBeUndefined();

    // OIDC-flow cookies should all be cleared.
    for (const name of [
      "code_verifier",
      "nonce",
      "state",
      "return_to",
      "mobile_return_scheme",
    ]) {
      const cleared = findCookie(cookies, name);
      expect(cleared, `${name} should be cleared`).toBeDefined();
      expect(cleared).toMatch(new RegExp(`^${name}=;`));
    }
  });

  it("sets the web session cookie on /api/callback when there is no mobile cookie", async () => {
    authorizationCodeGrant.mockResolvedValue({
      access_token: "access_test",
      refresh_token: "refresh_test",
      claims: () => ({
        sub: "user_web_456",
        email: "web@example.com",
        first_name: "We",
        last_name: "Bb",
        picture: null,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      expiresIn: () => 3600,
    });

    const app = await buildApp();
    const res = await request(app)
      .get("/api/callback")
      .query({ code: "AUTH_CODE", state: "STATE_TEST" })
      .set(
        "Cookie",
        [
          "code_verifier=VERIFIER_TEST",
          "nonce=NONCE_TEST",
          "state=STATE_TEST",
          "return_to=/dashboard",
        ].join("; "),
      );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/dashboard");
    expect(insertedSessions).toHaveLength(1);
    const sid = insertedSessions[0].sid;

    const cookies = getSetCookies(res);
    const sessionCookie = findCookie(cookies, "sid");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain(`sid=${sid}`);
    expect(sessionCookie!.toLowerCase()).toContain("httponly");
  });
});

describe("/api/auth/user", () => {
  beforeEach(() => {
    insertedUsers.length = 0;
    insertedSessions.length = 0;
    deleteSessionCalls.length = 0;
    authorizationCodeGrant.mockReset();
  });

  it("returns user: null when there is no session", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/auth/user");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it("returns the current user when authenticated", async () => {
    const user = {
      id: "user_abc",
      email: "abc@example.com",
      firstName: "Ay",
      lastName: "Bee",
      profileImageUrl: null,
    };
    const app = await buildApp({ user });
    const res = await request(app).get("/api/auth/user");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user });
  });
});

describe("/api/logout", () => {
  beforeEach(() => {
    insertedUsers.length = 0;
    insertedSessions.length = 0;
    deleteSessionCalls.length = 0;
    authorizationCodeGrant.mockReset();
  });

  it("clears the session cookie and redirects to the OIDC end-session URL", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/logout")
      .set("Cookie", "sid=existing_sid");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://replit.com/oidc/end");

    // The DB-side session should be deleted.
    expect(deleteSessionCalls).toHaveLength(1);

    // The session cookie should be cleared on the client.
    const cookies = getSetCookies(res);
    const cleared = findCookie(cookies, "sid");
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/^sid=;/);
  });

  it("still redirects to the end-session URL when there is no active session", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/logout");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://replit.com/oidc/end");
    // No sid → no DB delete.
    expect(deleteSessionCalls).toHaveLength(0);
  });
});

describe("POST /api/mobile-auth/token-exchange", () => {
  beforeEach(() => {
    insertedUsers.length = 0;
    insertedSessions.length = 0;
    deleteSessionCalls.length = 0;
    authorizationCodeGrant.mockReset();
  });

  it("rejects a malformed body with 400", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/mobile-auth/token-exchange")
      .send({ code: "" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Missing or invalid required parameters",
    });
    expect(authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it("exchanges a valid code for a session token", async () => {
    authorizationCodeGrant.mockResolvedValue({
      access_token: "access_test",
      refresh_token: "refresh_test",
      claims: () => ({
        sub: "user_mobile_xyz",
        email: "mxyz@example.com",
        first_name: "Mo",
        last_name: "Bile",
        picture: null,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      expiresIn: () => 3600,
    });

    const app = await buildApp();
    const res = await request(app).post("/api/mobile-auth/token-exchange").send({
      code: "AUTH_CODE",
      code_verifier: "VERIFIER_TEST",
      redirect_uri: "pawplay://auth-callback",
      state: "STATE_TEST",
      nonce: "NONCE_TEST",
    });

    expect(res.status).toBe(200);
    expect(insertedSessions).toHaveLength(1);
    const sid = insertedSessions[0].sid;
    expect(res.body).toEqual({ token: sid });
  });

  it("returns 401 when the ID token has no claims", async () => {
    authorizationCodeGrant.mockResolvedValue({
      access_token: "access_test",
      refresh_token: "refresh_test",
      claims: () => undefined,
      expiresIn: () => 3600,
    });

    const app = await buildApp();
    const res = await request(app).post("/api/mobile-auth/token-exchange").send({
      code: "AUTH_CODE",
      code_verifier: "VERIFIER_TEST",
      redirect_uri: "pawplay://auth-callback",
      state: "STATE_TEST",
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "No claims in ID token" });
    expect(insertedSessions).toHaveLength(0);
  });

  it("returns 500 when the OIDC grant throws", async () => {
    authorizationCodeGrant.mockRejectedValue(new Error("boom"));

    const app = await buildApp();
    const res = await request(app).post("/api/mobile-auth/token-exchange").send({
      code: "AUTH_CODE",
      code_verifier: "VERIFIER_TEST",
      redirect_uri: "pawplay://auth-callback",
      state: "STATE_TEST",
    });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Token exchange failed" });
    expect(insertedSessions).toHaveLength(0);
  });
});

describe("POST /api/mobile-auth/logout", () => {
  beforeEach(() => {
    insertedUsers.length = 0;
    insertedSessions.length = 0;
    deleteSessionCalls.length = 0;
  });

  it("returns success and deletes the session when a Bearer token is provided", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/mobile-auth/logout")
      .set("Authorization", "Bearer some_sid_value");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(deleteSessionCalls).toHaveLength(1);
  });

  it("returns success without touching the database when no token is provided", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/mobile-auth/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(deleteSessionCalls).toHaveLength(0);
  });
});

describe("/api/callback failure paths", () => {
  beforeEach(() => {
    insertedUsers.length = 0;
    insertedSessions.length = 0;
    deleteSessionCalls.length = 0;
    authorizationCodeGrant.mockReset();
  });

  it("redirects to /api/login and clears OIDC cookies when required cookies are missing", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/callback")
      .query({ code: "AUTH_CODE", state: "STATE_TEST" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/api/login");
    // No grant attempt should have been made.
    expect(authorizationCodeGrant).not.toHaveBeenCalled();
    // No session should have been created.
    expect(insertedSessions).toHaveLength(0);

    const cookies = getSetCookies(res);
    for (const name of [
      "code_verifier",
      "nonce",
      "state",
      "return_to",
      "mobile_return_scheme",
    ]) {
      const cleared = findCookie(cookies, name);
      expect(cleared, `${name} should be cleared`).toBeDefined();
      expect(cleared).toMatch(new RegExp(`^${name}=;`));
    }
  });

  it("redirects to /api/login and clears OIDC cookies when the OIDC grant fails", async () => {
    authorizationCodeGrant.mockRejectedValue(new Error("bad code"));

    const app = await buildApp();
    const res = await request(app)
      .get("/api/callback")
      .query({ code: "AUTH_CODE", state: "STATE_TEST" })
      .set(
        "Cookie",
        [
          "code_verifier=VERIFIER_TEST",
          "nonce=NONCE_TEST",
          "state=STATE_TEST",
        ].join("; "),
      );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/api/login");
    expect(insertedSessions).toHaveLength(0);

    const cookies = getSetCookies(res);
    for (const name of ["code_verifier", "nonce", "state", "return_to"]) {
      const cleared = findCookie(cookies, name);
      expect(cleared, `${name} should be cleared`).toBeDefined();
      expect(cleared).toMatch(new RegExp(`^${name}=;`));
    }
    // No session cookie set on failure.
    const sessionCookie = findCookie(cookies, "sid");
    if (sessionCookie) {
      // If anything sid-shaped slipped out, it must only be a clear, never a value.
      expect(sessionCookie).toMatch(/^sid=;/);
    }
  });

  it("redirects to /api/login when the cookie state does not match what the OIDC grant expects", async () => {
    // The route forwards the cookie's `state` as `expectedState` to the
    // grant; mocking the grant to throw on mismatch simulates an attacker
    // replaying a callback with a stale/forged state cookie.
    authorizationCodeGrant.mockImplementation(
      async (
        _config: unknown,
        _url: URL,
        opts: { expectedState?: string },
      ) => {
        if (opts.expectedState !== "STATE_TEST") {
          throw new Error("state mismatch");
        }
        return {} as never;
      },
    );

    const app = await buildApp();
    const res = await request(app)
      .get("/api/callback")
      .query({ code: "AUTH_CODE", state: "STATE_TEST" })
      .set(
        "Cookie",
        [
          "code_verifier=VERIFIER_TEST",
          "nonce=NONCE_TEST",
          "state=WRONG_STATE",
        ].join("; "),
      );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/api/login");
    expect(insertedSessions).toHaveLength(0);

    const cookies = getSetCookies(res);
    for (const name of ["code_verifier", "nonce", "state"]) {
      const cleared = findCookie(cookies, name);
      expect(cleared, `${name} should be cleared`).toBeDefined();
      expect(cleared).toMatch(new RegExp(`^${name}=;`));
    }
  });

  it("redirects to /api/login when the ID token has no claims", async () => {
    authorizationCodeGrant.mockResolvedValue({
      access_token: "access_test",
      refresh_token: "refresh_test",
      claims: () => undefined,
      expiresIn: () => 3600,
    });

    const app = await buildApp();
    const res = await request(app)
      .get("/api/callback")
      .query({ code: "AUTH_CODE", state: "STATE_TEST" })
      .set(
        "Cookie",
        [
          "code_verifier=VERIFIER_TEST",
          "nonce=NONCE_TEST",
          "state=STATE_TEST",
        ].join("; "),
      );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/api/login");
    expect(insertedSessions).toHaveLength(0);
  });
});
