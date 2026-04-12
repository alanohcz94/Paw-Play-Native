export type Difficulty = "easy" | "medium" | "expert";

export interface CommandResult {
  name: string;
  success: boolean;
  skipped: boolean;
  timeSeconds: number;
  windowSeconds: number;
  secondsOver: number;
  pointsEarned: number;
  resetCount: number;
}

export interface ScoreResult {
  rawScore: number;
  participationPoints: number;
  bonuses: BonusItem[];
  commandResults: CommandResult[];
}

export interface BonusItem {
  name: string;
  label: string;
  points: number;
}

export const DIFFICULTY_WINDOW: Record<Difficulty, number> = {
  easy: 6,
  medium: 4,
  expert: 2,
};

export const DIFFICULTY_COMPLETION_BONUS: Record<Difficulty, number> = {
  easy: 0,
  medium: 10,
  expert: 25,
};

export interface RawCommandInput {
  name: string;
  skipped: boolean;
  timeSeconds: number;
  windowSeconds: number;
  resetCount?: number;
  maxPoints?: number;
}

export function calculateScore(inputs: RawCommandInput[], difficulty: Difficulty): ScoreResult {
  const commandResults: CommandResult[] = inputs.map((input) => {
    let pointsEarned = 0;
    const secondsOver = Math.max(0, input.timeSeconds - input.windowSeconds);
    const maxPts = input.maxPoints ?? 20;

    if (input.skipped) {
      if (difficulty === "expert") {
        pointsEarned = -20 - Math.floor(secondsOver);
      } else {
        pointsEarned = 0;
      }
    } else if (input.timeSeconds <= input.windowSeconds) {
      pointsEarned = maxPts;
    } else {
      pointsEarned = -Math.floor(secondsOver);
    }

    return {
      name: input.name,
      success: !input.skipped && input.timeSeconds <= input.windowSeconds,
      skipped: input.skipped,
      timeSeconds: input.timeSeconds,
      windowSeconds: input.windowSeconds,
      secondsOver,
      pointsEarned,
      resetCount: input.resetCount ?? 0,
    };
  });

  const rawScore = commandResults.reduce((sum, r) => sum + r.pointsEarned, 0);

  const bonuses: BonusItem[] = [];

  const allWithinWindow = commandResults.every((r) => !r.skipped && r.timeSeconds <= r.windowSeconds);
  const noSkips = commandResults.every((r) => !r.skipped);

  if (allWithinWindow && commandResults.length >= 5) {
    bonuses.push({ name: "perfect_round", label: "Perfect Round", points: 20 });
  }

  const allUnderHalf = commandResults.every((r) => !r.skipped && r.timeSeconds <= r.windowSeconds / 2);
  if (allUnderHalf) {
    bonuses.push({ name: "speed_demon", label: "Speed Demon", points: 5 * commandResults.length });
  }

  let maxConsecutive = 0;
  let currentStreak = 0;
  let streakStartIdx = 0;
  let bestStreakStart = 0;
  let bestStreakLen = 0;
  for (let i = 0; i < commandResults.length; i++) {
    const r = commandResults[i];
    if (!r.skipped && r.timeSeconds <= r.windowSeconds) {
      if (currentStreak === 0) streakStartIdx = i;
      currentStreak++;
      if (currentStreak > bestStreakLen) {
        bestStreakLen = currentStreak;
        bestStreakStart = streakStartIdx;
      }
    } else {
      currentStreak = 0;
    }
  }
  if (bestStreakLen >= 3) {
    let streakBasePoints = 0;
    for (let i = bestStreakStart; i < bestStreakStart + bestStreakLen; i++) {
      streakBasePoints += commandResults[i].pointsEarned;
    }
    const comboBonus = Math.floor(streakBasePoints * 0.5);
    bonuses.push({ name: "combo_streak", label: "Combo Streak", points: comboBonus });
  }

  if (noSkips) {
    bonuses.push({ name: "clean_sweep", label: "Clean Sweep", points: 10 });
  }

  const zeroResets = commandResults.every((r) => r.resetCount === 0);
  if (zeroResets && commandResults.length > 0) {
    bonuses.push({ name: "first_cue", label: "First Cue", points: Math.min(3 * commandResults.length, 15) });
  }

  const diffBonus = DIFFICULTY_COMPLETION_BONUS[difficulty];
  if (diffBonus > 0) {
    bonuses.push({ name: "difficulty_bonus", label: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Mode`, points: diffBonus });
  }

  const totalBonusRaw = bonuses.reduce((sum, b) => sum + b.points, 0);
  const totalBonus = Math.min(totalBonusRaw, 50);

  const totalRaw = rawScore + totalBonus;

  return { rawScore: totalRaw, participationPoints: totalRaw, bonuses, commandResults };
}

export const ALL_COMMANDS = ["Sit", "Down", "Stay", "Come", "Heel", "Place", "Leave it"];
