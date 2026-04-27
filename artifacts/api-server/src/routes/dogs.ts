import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { dogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/users/:userId/dogs", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.params.userId as string;
  if (req.user.id !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const dogs = await db
    .select()
    .from(dogsTable)
    .where(eq(dogsTable.userId, userId));
  res.json({ dogs });
});

router.post("/dogs", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name, age, breed } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [dog] = await db
    .insert(dogsTable)
    .values({
      name,
      userId: req.user.id,
      age: age ?? null,
      breed: breed ?? null,
    })
    .returning();
  res.status(201).json(dog);
});

router.get("/dogs/:dogId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const dogId = req.params.dogId as string;
  const [dog] = await db
    .select()
    .from(dogsTable)
    .where(eq(dogsTable.id, dogId));
  if (!dog) {
    res.status(404).json({ error: "Dog not found" });
    return;
  }
  if (dog.userId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(dog);
});

router.patch("/dogs/:dogId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const dogId = req.params.dogId as string;
  const [existingDog] = await db
    .select()
    .from(dogsTable)
    .where(eq(dogsTable.id, dogId));
  if (!existingDog) {
    res.status(404).json({ error: "Dog not found" });
    return;
  }
  if (existingDog.userId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { name, age, breed, avatarUrl, releaseCue, markerCue } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (age !== undefined) updates.age = age;
  if (breed !== undefined) updates.breed = breed;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (releaseCue !== undefined) updates.releaseCue = releaseCue;
  if (markerCue !== undefined) updates.markerCue = markerCue;
  const [dog] = await db
    .update(dogsTable)
    .set(updates)
    .where(eq(dogsTable.id, dogId))
    .returning();
  res.json(dog);
});

router.delete("/dogs/:dogId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const dogId = req.params.dogId as string;
  const [existingDog] = await db
    .select()
    .from(dogsTable)
    .where(eq(dogsTable.id, dogId));
  if (!existingDog) {
    res.status(404).json({ error: "Dog not found" });
    return;
  }
  if (existingDog.userId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(dogsTable).where(eq(dogsTable.id, dogId));
  res.json({ success: true });
});

export default router;
