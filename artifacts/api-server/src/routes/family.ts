import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { familiesTable, pawplayUsersTable, sessionsRecordTable, dogsTable, commandsTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
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

  // Return existing family if user already has one (idempotent)
  const [existing] = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.id, userId));
  if (existing?.familyId) {
    const [existingFamily] = await db.select().from(familiesTable).where(eq(familiesTable.id, existing.familyId));
    if (existingFamily) {
      res.status(200).json({ ...existingFamily, memberIds: existingFamily.memberIds as string[] });
      return;
    }
  }

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

  // Find the user's current dog (in their old/solo family) before changing familyId
  const [pawUser] = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.id, userId));
  let userDog: typeof dogsTable.$inferSelect | undefined;
  let userCommands: (typeof commandsTable.$inferSelect)[] = [];
  try {
    if (pawUser?.familyId && pawUser.familyId !== family.id) {
      const userDogs = await db.select().from(dogsTable).where(eq(dogsTable.familyId, pawUser.familyId));
      userDog = userDogs[0];
      if (userDog) {
        userCommands = await db.select().from(commandsTable).where(eq(commandsTable.dogId, userDog.id));
      }
    }
  } catch (e) {
    console.error("Failed to load user dog/commands for merge (non-fatal):", e);
  }

  // Add user to the new family
  const memberIds = (family.memberIds as string[]) || [];
  if (!memberIds.includes(userId)) {
    memberIds.push(userId);
    await db.update(familiesTable).set({ memberIds: memberIds as unknown as Record<string, unknown> }).where(eq(familiesTable.id, family.id));
  }
  await db.insert(pawplayUsersTable).values({ id: userId, familyId: family.id, role: "adult" })
    .onConflictDoUpdate({ target: pawplayUsersTable.id, set: { familyId: family.id } });

  // Merge dog data if the user had a dog whose name matches one in the target family
  let mergedDog: typeof dogsTable.$inferSelect | null = null;
  if (userDog) {
    try {
      const familyDogs = await db.select().from(dogsTable).where(eq(dogsTable.familyId, family.id));
      const matchingDog = familyDogs.find(
        (d: typeof dogsTable.$inferSelect) => d.name.toLowerCase() === userDog!.name.toLowerCase()
      );

      if (matchingDog) {
        // Merge commands: sum counts for matching names, add new ones
        const familyCommands = await db.select().from(commandsTable).where(eq(commandsTable.dogId, matchingDog.id));
        const familyCommandMap = new Map(familyCommands.map((c: typeof commandsTable.$inferSelect) => [c.name.toLowerCase(), c]));

        for (const uc of userCommands) {
          const existing = familyCommandMap.get(uc.name.toLowerCase());
          if (existing) {
            const newTraining = existing.trainingSessionsCount + uc.trainingSessionsCount;
            const newQbSuccesses = existing.qbSuccessesCount + uc.qbSuccessesCount;
            const newQbSessions = existing.qbSessionsWithSuccess + uc.qbSessionsWithSuccess;
            const newBlitz = (existing.blitzSuccessesCount ?? 0) + (uc.blitzSuccessesCount ?? 0);
            const newLevel = Math.max(existing.level, uc.level);
            await db.update(commandsTable).set({
              level: newLevel,
              trainingSessionsCount: newTraining,
              qbSuccessesCount: newQbSuccesses,
              qbSessionsWithSuccess: newQbSessions,
              blitzSuccessesCount: newBlitz,
              lastUsedAt: existing.lastUsedAt && uc.lastUsedAt
                ? new Date(Math.max(new Date(existing.lastUsedAt).getTime(), new Date(uc.lastUsedAt).getTime()))
                : existing.lastUsedAt ?? uc.lastUsedAt,
            }).where(eq(commandsTable.id, existing.id));
          } else {
            await db.insert(commandsTable).values({
              dogId: matchingDog.id,
              name: uc.name,
              level: uc.level,
              trainingSessionsCount: uc.trainingSessionsCount,
              qbSuccessesCount: uc.qbSuccessesCount,
              qbSessionsWithSuccess: uc.qbSessionsWithSuccess,
              blitzSuccessesCount: uc.blitzSuccessesCount,
              lastUsedAt: uc.lastUsedAt,
            });
          }
        }

        // Re-attribute user's sessions to the family dog
        await db
          .update(sessionsRecordTable)
          .set({ dogId: matchingDog.id })
          .where(and(eq(sessionsRecordTable.dogId, userDog.id), eq(sessionsRecordTable.userId, userId)));

        // Remove the solo dog (no longer needed)
        await db.delete(commandsTable).where(eq(commandsTable.dogId, userDog.id));
        await db.delete(dogsTable).where(eq(dogsTable.id, userDog.id));

        // Fetch the updated family dog
        const [refreshedDog] = await db.select().from(dogsTable).where(eq(dogsTable.id, matchingDog.id));
        mergedDog = refreshedDog ?? null;
      } else {
        // No name match — move user's dog to the new family
        await db.update(dogsTable).set({ familyId: family.id }).where(eq(dogsTable.id, userDog.id));
        const [movedDog] = await db.select().from(dogsTable).where(eq(dogsTable.id, userDog.id));
        mergedDog = movedDog ?? null;
      }
    } catch (e) {
      console.error("Dog merge failed during family join (non-fatal):", e);
    }
  }

  res.json({
    family: { ...family, memberIds },
    dog: mergedDog,
  });
});

router.post("/family/leave", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const { dogId: sourceDogId } = req.body as { dogId?: string };

  const [pawUser] = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.id, userId));

  let sourcedog: typeof dogsTable.$inferSelect | undefined;
  let sourceCommands: (typeof commandsTable.$inferSelect)[] = [];

  if (pawUser?.familyId) {
    // Find the dog to clone (caller-supplied or first dog in family)
    const familyDogs = await db.select().from(dogsTable).where(eq(dogsTable.familyId, pawUser.familyId));
    sourcedog = sourceDogId
      ? familyDogs.find((d) => d.id === sourceDogId)
      : familyDogs[0];

    if (sourcedog) {
      sourceCommands = await db.select().from(commandsTable).where(eq(commandsTable.dogId, sourcedog.id));
    }

    // Remove user from old family
    await db
      .update(familiesTable)
      .set({ memberIds: sql`COALESCE(${familiesTable.memberIds}, '[]'::jsonb) - ${userId}` })
      .where(eq(familiesTable.id, pawUser.familyId));
  }

  // Create new solo family
  const [newFamily] = await db
    .insert(familiesTable)
    .values({
      createdBy: userId,
      inviteCode: generateInviteCode(),
      memberIds: [userId] as unknown as Record<string, unknown>,
    })
    .returning();

  await db
    .insert(pawplayUsersTable)
    .values({ id: userId, familyId: newFamily.id, role: "adult" })
    .onConflictDoUpdate({ target: pawplayUsersTable.id, set: { familyId: newFamily.id } });

  // Clone dog + commands into new family; re-attribute user's sessions
  let newDog: typeof dogsTable.$inferSelect | null = null;
  if (sourcedog) {
    const [clonedDog] = await db.insert(dogsTable).values({
      familyId: newFamily.id,
      name: sourcedog.name,
      age: sourcedog.age,
      breed: sourcedog.breed,
      avatarUrl: sourcedog.avatarUrl,
      releaseCue: sourcedog.releaseCue,
      markerCue: sourcedog.markerCue,
      level: sourcedog.level,
      xp: sourcedog.xp,
    }).returning();
    newDog = clonedDog;

    if (sourceCommands.length > 0) {
      await db.insert(commandsTable).values(
        sourceCommands.map((cmd) => ({
          dogId: clonedDog.id,
          name: cmd.name,
          level: cmd.level,
          trainingSessionsCount: cmd.trainingSessionsCount,
          qbSuccessesCount: cmd.qbSuccessesCount,
          qbSessionsWithSuccess: cmd.qbSessionsWithSuccess,
          blitzSuccessesCount: cmd.blitzSuccessesCount,
          lastUsedAt: cmd.lastUsedAt,
        }))
      );
    }

    // Re-attribute this user's sessions to the new dog so history follows them
    await db
      .update(sessionsRecordTable)
      .set({ dogId: clonedDog.id })
      .where(and(eq(sessionsRecordTable.dogId, sourcedog.id), eq(sessionsRecordTable.userId, userId)));
  }

  res.status(201).json({
    family: { ...newFamily, memberIds: newFamily.memberIds as string[] },
    dog: newDog,
  });
});

router.get("/family/:familyId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { familyId } = req.params;
  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, familyId));
  if (!family) {
    res.status(404).json({ error: "Family not found" });
    return;
  }
  res.json({ ...family, memberIds: family.memberIds as string[] });
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
  // end of the last day of the month (not midnight — that misses the whole day)
  const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

  const sessions = memberIds.length > 0
    ? await db.select().from(sessionsRecordTable).where(
        and(
          sql`${sessionsRecordTable.createdAt} >= ${startDate} AND ${sessionsRecordTable.createdAt} <= ${endDate}`,
          inArray(sessionsRecordTable.userId, memberIds)
        )
      )
    : [];

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
