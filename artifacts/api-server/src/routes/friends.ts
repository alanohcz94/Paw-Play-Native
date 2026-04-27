import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  pawplayUsersTable,
  friendshipsTable,
  sessionsRecordTable,
} from "@workspace/db";

const router: IRouter = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

async function ensurePawplayUser(
  userId: string,
  displayName: string | null,
  email: string | null,
) {
  const [existing] = await db
    .select()
    .from(pawplayUsersTable)
    .where(eq(pawplayUsersTable.id, userId));
  if (existing) return existing;

  for (let attempt = 0; attempt < 6; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      const [created] = await db
        .insert(pawplayUsersTable)
        .values({
          id: userId,
          displayName: displayName ?? "User",
          email,
          inviteCode,
        })
        .returning();
      return created;
    } catch (err) {
      // Race-create from another request
      const [refetched] = await db
        .select()
        .from(pawplayUsersTable)
        .where(eq(pawplayUsersTable.id, userId));
      if (refetched) return refetched;
      // Otherwise probably an invite_code unique collision — try again
      if (attempt === 5) throw err;
    }
  }
  throw new Error("Failed to allocate unique invite code");
}

router.get("/users/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const me = await ensurePawplayUser(
    req.user.id,
    req.user.firstName ?? null,
    req.user.email ?? null,
  );
  res.json(me);
});

router.get("/friends", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const rows = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.userId, userId));
  if (rows.length === 0) {
    res.json({ friends: [] });
    return;
  }
  const friendIds = rows.map((r) => r.friendId);
  const users = await db
    .select({
      id: pawplayUsersTable.id,
      displayName: pawplayUsersTable.displayName,
      inviteCode: pawplayUsersTable.inviteCode,
    })
    .from(pawplayUsersTable)
    .where(inArray(pawplayUsersTable.id, friendIds));
  res.json({ friends: users });
});

router.post("/friends", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const codeRaw =
    typeof req.body?.code === "string" ? (req.body.code as string) : "";
  const code = codeRaw.trim().toUpperCase();
  if (code.length !== 6) {
    res.status(400).json({ error: "Invite code must be 6 characters" });
    return;
  }

  await ensurePawplayUser(
    userId,
    req.user.firstName ?? null,
    req.user.email ?? null,
  );

  const [target] = await db
    .select({
      id: pawplayUsersTable.id,
      displayName: pawplayUsersTable.displayName,
      inviteCode: pawplayUsersTable.inviteCode,
    })
    .from(pawplayUsersTable)
    .where(eq(pawplayUsersTable.inviteCode, code));
  if (!target) {
    res.status(404).json({ error: "No user found with that invite code" });
    return;
  }
  if (target.id === userId) {
    res.status(400).json({ error: "You can't add yourself as a friend" });
    return;
  }

  const [existing] = await db
    .select()
    .from(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.userId, userId),
        eq(friendshipsTable.friendId, target.id),
      ),
    );
  if (existing) {
    res.status(409).json({ error: "Already friends" });
    return;
  }

  await db
    .insert(friendshipsTable)
    .values([
      { userId, friendId: target.id },
      { userId: target.id, friendId: userId },
    ])
    .onConflictDoNothing();

  res.status(201).json({ friend: target });
});

router.delete("/friends/:friendId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const friendId = req.params.friendId as string;
  await db
    .delete(friendshipsTable)
    .where(
      or(
        and(
          eq(friendshipsTable.userId, userId),
          eq(friendshipsTable.friendId, friendId),
        ),
        and(
          eq(friendshipsTable.userId, friendId),
          eq(friendshipsTable.friendId, userId),
        ),
      ),
    );
  res.json({ success: true });
});

router.get("/leaderboard", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  await ensurePawplayUser(
    userId,
    req.user.firstName ?? null,
    req.user.email ?? null,
  );
  const friendRows = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.userId, userId));
  const ids = [userId, ...friendRows.map((r) => r.friendId)];
  const users = await db
    .select()
    .from(pawplayUsersTable)
    .where(inArray(pawplayUsersTable.id, ids));
  const sessions = await db
    .select()
    .from(sessionsRecordTable)
    .where(inArray(sessionsRecordTable.userId, ids));
  const entries = users
    .map((u) => {
      const userSessions = sessions.filter((s) => s.userId === u.id);
      const totalPoints = userSessions.reduce(
        (sum, s) => sum + (s.participationPoints || 0),
        0,
      );
      return {
        userId: u.id,
        displayName: u.displayName || "User",
        totalPoints,
        sessionCount: userSessions.length,
        profileImageUrl: null as string | null,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
  res.json({ entries });
});

router.get("/calendar", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!Number.isFinite(month) || !Number.isFinite(year)) {
    res.status(400).json({ error: "month and year required" });
    return;
  }

  const friendRows = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.userId, userId));
  const friendIds = friendRows.map((r) => r.friendId);
  const allIds = [userId, ...friendIds];

  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  const sessions = await db
    .select()
    .from(sessionsRecordTable)
    .where(
      and(
        gte(sessionsRecordTable.createdAt, startDate),
        lte(sessionsRecordTable.createdAt, endDate),
        inArray(sessionsRecordTable.userId, allIds),
      ),
    );

  const daysInMonth = endDate.getDate();
  const days: {
    date: string;
    trainedByMe: boolean;
    trainedByFriends: boolean;
    sessionCount: number;
  }[] = [];
  let totalSessions = 0;
  let totalDurationSeconds = 0;
  let scoreSum = 0;
  let scoredCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d);
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const daySessions = sessions.filter((s) => {
      const sd = s.createdAt ? new Date(s.createdAt) : null;
      return (
        sd &&
        sd.getFullYear() === day.getFullYear() &&
        sd.getMonth() === day.getMonth() &&
        sd.getDate() === day.getDate()
      );
    });
    const trainedByMe = daySessions.some((s) => s.userId === userId);
    const trainedByFriends = daySessions.some(
      (s) => s.userId !== userId && friendIds.includes(s.userId),
    );
    days.push({
      date: dateStr,
      trainedByMe,
      trainedByFriends,
      sessionCount: daySessions.length,
    });
    totalSessions += daySessions.length;
    for (const s of daySessions) {
      totalDurationSeconds += s.durationSeconds || 0;
      scoreSum += s.participationPoints || 0;
      scoredCount++;
    }
  }

  res.json({
    days,
    totalSessions,
    totalHours: parseFloat((totalDurationSeconds / 3600).toFixed(2)),
    avgScore: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0,
  });
});

router.get("/yearly-chart", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const year = Number(req.query.year);
  if (!Number.isFinite(year)) {
    res.status(400).json({ error: "year required" });
    return;
  }

  const friendRows = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.userId, userId));
  const allIds = [userId, ...friendRows.map((r) => r.friendId)];

  const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  const sessions = await db
    .select()
    .from(sessionsRecordTable)
    .where(
      and(
        gte(sessionsRecordTable.createdAt, startDate),
        lte(sessionsRecordTable.createdAt, endDate),
        inArray(sessionsRecordTable.userId, allIds),
      ),
    );

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const months = Array.from({ length: 12 }, (_, i) => {
    const ms = sessions.filter((s) => {
      const sd = s.createdAt ? new Date(s.createdAt) : null;
      return sd && sd.getMonth() === i;
    });
    const hours = ms.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
    return {
      month: i + 1,
      hours: parseFloat(hours.toFixed(2)),
      sessions: ms.length,
    };
  });
  const totalHours = parseFloat(
    months.reduce((sum, m) => sum + m.hours, 0).toFixed(2),
  );
  const best = months.reduce((b, m) => (m.hours > b.hours ? m : b), months[0]);
  const bestMonth = best.hours > 0 ? monthNames[best.month - 1] : null;

  res.json({ months, totalHours, bestMonth });
});

export default router;
