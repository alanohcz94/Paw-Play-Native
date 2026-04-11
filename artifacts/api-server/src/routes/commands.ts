import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { commandsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

router.get("/dogs/:dogId/commands", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { dogId } = req.params;
  const commands = await db.select().from(commandsTable).where(eq(commandsTable.dogId, dogId));
  res.json({ commands });
});

router.post("/dogs/:dogId/commands", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { dogId } = req.params;
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const existing = await db.select().from(commandsTable).where(and(eq(commandsTable.dogId, dogId), eq(commandsTable.name, name)));
  if (existing.length > 0) {
    res.status(409).json({ error: "Command already exists" });
    return;
  }
  const [cmd] = await db.insert(commandsTable).values({ dogId, name, level: 1 }).returning();
  res.status(201).json(cmd);
});

router.patch("/commands/:dogId/:name", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { dogId, name } = req.params;
  const updates: Record<string, unknown> = {};
  const { level, trainingSessionsCount, qbSuccessesCount, qbSessionsWithSuccess } = req.body;
  if (level !== undefined) updates.level = level;
  if (trainingSessionsCount !== undefined) updates.trainingSessionsCount = trainingSessionsCount;
  if (qbSuccessesCount !== undefined) updates.qbSuccessesCount = qbSuccessesCount;
  if (qbSessionsWithSuccess !== undefined) updates.qbSessionsWithSuccess = qbSessionsWithSuccess;
  updates.lastUsedAt = new Date();
  const [cmd] = await db.update(commandsTable).set(updates).where(and(eq(commandsTable.dogId, dogId), eq(commandsTable.name, name))).returning();
  if (!cmd) {
    res.status(404).json({ error: "Command not found" });
    return;
  }
  res.json(cmd);
});

export default router;
