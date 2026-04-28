import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/api-zod", () => ({
  HealthCheckResponse: { parse: (v: unknown) => v },
}));

async function buildApp() {
  const { default: healthRouter } = await import("./health");
  const app = express();
  app.use("/api", healthRouter);
  return app;
}

describe("GET /api/healthz", () => {
  it("returns 200 with status ok", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("responds to repeated calls without error", async () => {
    const app = await buildApp();
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/api/healthz");
      expect(res.status).toBe(200);
    }
  });

  it("returns JSON content-type", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/healthz");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
