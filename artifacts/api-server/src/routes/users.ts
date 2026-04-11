import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { pawplayUsersTable, pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

router.get("/dogs/:dogId/achievements", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ achievements: [] });
});

export default router;
