import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { dogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/dogs", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name, familyId, age, breed } = req.body;
  if (!name || !familyId) {
    res.status(400).json({ error: "name and familyId are required" });
    return;
  }
  const [dog] = await db.insert(dogsTable).values({ name, familyId, age: age ?? null, breed: breed ?? null }).returning();
  res.status(201).json(dog);
});

router.get("/dogs/:dogId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { dogId } = req.params;
  const [dog] = await db.select().from(dogsTable).where(eq(dogsTable.id, dogId));
  if (!dog) {
    res.status(404).json({ error: "Dog not found" });
    return;
  }
  res.json(dog);
});

router.patch("/dogs/:dogId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { dogId } = req.params;
  const { name, age, breed, avatarUrl, releaseCue, markerCue } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (age !== undefined) updates.age = age;
  if (breed !== undefined) updates.breed = breed;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (releaseCue !== undefined) updates.releaseCue = releaseCue;
  if (markerCue !== undefined) updates.markerCue = markerCue;
  const [dog] = await db.update(dogsTable).set(updates).where(eq(dogsTable.id, dogId)).returning();
  if (!dog) {
    res.status(404).json({ error: "Dog not found" });
    return;
  }
  res.json(dog);
});

export default router;
