import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { familiesTable, pawplayUsersTable, sessionsRecordTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

router.post("/family", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const inviteCode = generateInviteCode();
  const [family] = await db.insert(familiesTable).values({
    createdBy: userId,
    inviteCode,
    memberIds: [userId] as unknown as Record<string, unknown>,
  }).returning();

  await db.insert(pawplayUsersTable).values({ id: userId, familyId: family.id, role: "adult" })
    .onConflictDoUpdate({ target: pawplayUsersTable.id, set: { familyId: family.id } });

  res.status(201).json({ ...family, memberIds: family.memberIds as string[] });
});

router.post("/family/join/:code", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { code } = req.params;
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.inviteCode, code.toUpperCase()));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  const memberIds = (family.memberIds as string[]) || [];
  if (!memberIds.includes(userId)) {
    memberIds.push(userId);
    await db.update(familiesTable).set({ memberIds: memberIds as unknown as Record<string, unknown> }).where(eq(familiesTable.id, family.id));
  }
  await db.insert(pawplayUsersTable).values({ id: userId, familyId: family.id, role: "adult" })
    .onConflictDoUpdate({ target: pawplayUsersTable.id, set: { familyId: family.id } });
  res.json({ ...family, memberIds });
});

router.get("/family/:familyId/leaderboard", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { familyId } = req.params;
  const members = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.familyId, familyId));
  const entries = await Promise.all(members.map(async (member) => {
    const sessions = await db.select().from(sessionsRecordTable).where(eq(sessionsRecordTable.userId, member.id));
    const totalPoints = sessions.reduce((sum, s) => sum + (s.participationPoints || 0), 0);
    return {
      userId: member.id,
      displayName: member.displayName || "Family Member",
      totalPoints,
      sessionCount: sessions.length,
      profileImageUrl: null,
    };
  }));
  entries.sort((a, b) => b.totalPoints - a.totalPoints);
  res.json({ entries });
});

router.get("/family/:familyId/calendar", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { familyId } = req.params;
  const { month, year } = req.query;
  const userId = req.user.id;

  const members = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.familyId, familyId));
  const memberIds = members.map((m) => m.id);

  const startDate = new Date(Number(year), Number(month) - 1, 1);
  const endDate = new Date(Number(year), Number(month), 0);

  const sessions = await db.select().from(sessionsRecordTable)
    .where(sql`${sessionsRecordTable.createdAt} >= ${startDate} AND ${sessionsRecordTable.createdAt} <= ${endDate}`);

  const daysInMonth = endDate.getDate();
  const days = [];
  let totalSessions = 0;
  let totalDurationSeconds = 0;
  let totalScore = 0;
  let scoredSessions = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Number(year), Number(month) - 1, d);
    const dateStr = date.toISOString().split("T")[0];
    const daySessions = sessions.filter((s) => {
      const sDate = new Date(s.createdAt!).toISOString().split("T")[0];
      return sDate === dateStr;
    });
    const trainedByMe = daySessions.some((s) => s.userId === userId);
    const trainedByFamily = daySessions.some((s) => s.userId !== userId && memberIds.includes(s.userId));
    totalSessions += daySessions.length;
    totalDurationSeconds += daySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    for (const s of daySessions) {
      totalScore += s.participationPoints || 0;
      scoredSessions++;
    }
    days.push({ date: dateStr, trainedByMe, trainedByFamily, sessionCount: daySessions.length });
  }

  res.json({
    days,
    totalSessions,
    totalHours: parseFloat((totalDurationSeconds / 3600).toFixed(2)),
    avgScore: scoredSessions > 0 ? Math.round(totalScore / scoredSessions) : 0,
  });
});

router.get("/family/:familyId/yearly-chart", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { familyId } = req.params;
  const { year } = req.query;
  const members = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.familyId, familyId));
  const memberIds = members.map((m) => m.id);

  const startDate = new Date(Number(year), 0, 1);
  const endDate = new Date(Number(year), 11, 31);

  const sessions = await db.select().from(sessionsRecordTable)
    .where(sql`${sessionsRecordTable.createdAt} >= ${startDate} AND ${sessionsRecordTable.createdAt} <= ${endDate}`);

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthSessions = sessions.filter((s) => {
      return new Date(s.createdAt!).getMonth() === i;
    });
    const hours = monthSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
    return { month: i + 1, hours: parseFloat(hours.toFixed(2)), sessions: monthSessions.length };
  });

  const totalHours = parseFloat(months.reduce((sum, m) => sum + m.hours, 0).toFixed(2));
  const bestMonthData = months.reduce((best, m) => m.hours > best.hours ? m : best, months[0]);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const bestMonth = bestMonthData.hours > 0 ? monthNames[bestMonthData.month - 1] : null;

  res.json({ months, totalHours, bestMonth });
});

export default router;
