import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  pawplayUsersTable,
  pushTokensTable,
  usersTable,
  familiesTable,
  sessionsRecordTable,
  achievementsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { deleteSession, getSessionId } from "../lib/auth";

const router = Router();

router.get("/users/:userId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { userId } = req.params;
  const [user] = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.patch("/users/:userId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { userId } = req.params;
  const { displayName, familyId, expoPushToken } = req.body;
  const updates: Record<string, unknown> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  if (familyId !== undefined) updates.familyId = familyId;
  if (expoPushToken !== undefined) updates.expoPushToken = expoPushToken;

  const [existing] = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.id, userId));
  if (!existing) {
    const [created] = await db.insert(pawplayUsersTable).values({ id: userId, ...updates }).returning();
    res.json(created);
    return;
  }
  const [updated] = await db.update(pawplayUsersTable).set(updates).where(eq(pawplayUsersTable.id, userId)).returning();
  res.json(updated);
});

router.patch("/users/:userId/push-token", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { userId } = req.params;
  const { expoPushToken, platform } = req.body;
  await db.insert(pushTokensTable).values({ userId, expoPushToken, platform: platform ?? "ios" })
    .onConflictDoUpdate({ target: pushTokensTable.userId, set: { expoPushToken, platform, updatedAt: new Date() } });
  res.json({ success: true });
});

router.delete("/users/:userId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { userId } = req.params;
  if (req.user.id !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [pawUser] = await db.select().from(pawplayUsersTable).where(eq(pawplayUsersTable.id, userId));

  if (pawUser?.familyId) {
    const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, pawUser.familyId));
    if (family) {
      const updatedMembers = (family.memberIds as string[]).filter((id) => id !== userId);
      await db.update(familiesTable)
        .set({ memberIds: updatedMembers as unknown as Record<string, unknown> })
        .where(eq(familiesTable.id, family.id));
    }
  }

  await db.delete(sessionsRecordTable).where(eq(sessionsRecordTable.userId, userId));
  await db.delete(achievementsTable).where(eq(achievementsTable.userId, userId));
  await db.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId));
  await db.delete(pawplayUsersTable).where(eq(pawplayUsersTable.id, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }

  res.json({ success: true });
});

router.get("/dogs/:dogId/achievements", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ achievements: [] });
});

export default router;
