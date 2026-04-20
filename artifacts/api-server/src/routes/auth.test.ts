import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

const insertedUsers: unknown[] = [];
const insertedSessions: { sid: string; sess: unknown }[] = [];

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
    delete: () => ({ where: async () => undefined }),
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

async function buildApp(): Promise<Express> {
  const { default: authRouter } = await import("./auth");
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Mimic production app: auth middleware adds isAuthenticated().
  app.use((req, _res, next) => {
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated =
      () => false;
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
