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
import { eq, sql } from "drizzle-orm";
import { sessionsTable } from "@workspace/db";
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

  try {
    await db.transaction(async (tx) => {
      const [pawUser] = await tx
        .select()
        .from(pawplayUsersTable)
        .where(eq(pawplayUsersTable.id, userId));

      if (pawUser?.familyId) {
        await tx
          .update(familiesTable)
          .set({
            memberIds: sql`COALESCE(${familiesTable.memberIds}, '[]'::jsonb) - ${userId}::text`,
          })
          .where(eq(familiesTable.id, pawUser.familyId));
      }

      await tx.delete(sessionsRecordTable).where(eq(sessionsRecordTable.userId, userId));
      await tx.delete(achievementsTable).where(eq(achievementsTable.userId, userId));
      await tx.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId));
      await tx.delete(pawplayUsersTable).where(eq(pawplayUsersTable.id, userId));
      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    });
  } catch (err) {
    req.log?.error({ err, userId }, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account" });
    return;
  }

  // Clean up any remaining auth sessions for this user outside the transaction
  // so a failure here doesn't roll back the account deletion.
  try {
    await db
      .delete(sessionsTable)
      .where(sql`${sessionsTable.sess}::text like ${"%" + userId + "%"}`);
  } catch (err) {
    req.log?.warn({ err, userId }, "Could not clean up auth sessions after account deletion");
  }

  const sid = getSessionId(req);
  if (sid) {
    try {
      await deleteSession(sid);
    } catch (err) {
      req.log?.warn({ err, sid }, "Failed to delete current session after account deletion");
    }
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
