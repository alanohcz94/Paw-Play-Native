import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sessionsRecordTable, commandsTable } from "@workspace/db";
import { and, eq, sql, gte, lte } from "drizzle-orm";

const router = Router();

function evaluateCommandLevel(cmd: {
  trainingSessionsCount: number;
  qbSuccessesCount: number;
  qbSessionsWithSuccess: number;
}): number {
  if (cmd.qbSuccessesCount >= 10 && cmd.qbSessionsWithSuccess >= 3) return 3;
  if (cmd.trainingSessionsCount >= 5) return 2;
  return 1;
}

router.post("/sessions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { dogId, mode, difficulty, rawScore, participationPoints, bonuses, commandsUsed, durationSeconds, completed } = req.body;
  if (!dogId || !mode) {
    res.status(400).json({ error: "dogId and mode are required" });
    return;
  }

  const [session] = await db.insert(sessionsRecordTable).values({
    dogId,
    userId,
    mode,
    difficulty: difficulty ?? null,
    rawScore,
    participationPoints,
    bonuses: bonuses ?? [],
    commandsUsed: commandsUsed ?? [],
    durationSeconds: durationSeconds ?? null,
    completed: completed ?? false,
  }).returning();

  if (completed && commandsUsed && commandsUsed.length > 0) {
    type CmdEntry = { name: string; success?: boolean; count?: number };
    const entries: CmdEntry[] = commandsUsed;
    const hasSuccess = entries.some((c) => c.success);

    // Group entries by command name and sum counts so we can do one DB update per command
    const byName: Record<string, { totalCount: number; anySuccess: boolean }> = {};
    for (const entry of entries) {
      const n = entry.name;
      if (!byName[n]) byName[n] = { totalCount: 0, anySuccess: false };
      byName[n].totalCount += entry.count ?? 1;
      if (entry.success) byName[n].anySuccess = true;
    }

    for (const [name, agg] of Object.entries(byName)) {
      const [existing] = await db.select().from(commandsTable)
        .where(and(eq(commandsTable.dogId, dogId), eq(commandsTable.name, name)));
      if (!existing) continue;

      const repCount = agg.totalCount;
      const newTrainingCount = mode === "training"
        ? existing.trainingSessionsCount + repCount
        : existing.trainingSessionsCount;
      const newQbSuccesses = (mode === "quickbites" || mode === "challenge") && agg.anySuccess
        ? existing.qbSuccessesCount + repCount
        : existing.qbSuccessesCount;
      const newQbSessionsWithSuccess = (mode === "quickbites" || mode === "challenge") && hasSuccess
        ? existing.qbSessionsWithSuccess + 1
        : existing.qbSessionsWithSuccess;
      const newLevel = evaluateCommandLevel({
        trainingSessionsCount: newTrainingCount,
        qbSuccessesCount: newQbSuccesses,
        qbSessionsWithSuccess: newQbSessionsWithSuccess,
      });
      await db.update(commandsTable).set({
        level: newLevel,
        trainingSessionsCount: newTrainingCount,
        qbSuccessesCount: newQbSuccesses,
        qbSessionsWithSuccess: newQbSessionsWithSuccess,
        lastUsedAt: new Date(),
      }).where(and(eq(commandsTable.dogId, dogId), eq(commandsTable.name, name)));
    }
  }

  res.status(201).json(session);
});

router.get("/sessions", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { dogId, userId, limit, date } = req.query;
  const conditions = [];
  if (dogId) conditions.push(eq(sessionsRecordTable.dogId, dogId as string));
  if (userId) conditions.push(eq(sessionsRecordTable.userId, userId as string));
  if (date) {
    // date = "YYYY-MM-DD", match full day in UTC
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    conditions.push(gte(sessionsRecordTable.createdAt, dayStart));
    conditions.push(lte(sessionsRecordTable.createdAt, dayEnd));
  }

  const sessions = await db.select().from(sessionsRecordTable)
    .where(conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined)
    .limit(limit ? parseInt(limit as string) : 100)
    .orderBy(sql`${sessionsRecordTable.createdAt} desc`);
  res.json({ sessions });
});

export default router;
