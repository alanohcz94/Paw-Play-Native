export type Difficulty = "easy" | "medium" | "expert";

export interface CommandResult {
  name: string;
  success: boolean;
  skipped: boolean;
  timeSeconds: number;
  windowSeconds: number;
  secondsOver: number;
  pointsEarned: number;
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
}

export function calculateScore(inputs: RawCommandInput[], difficulty: Difficulty): ScoreResult {
  const commandResults: CommandResult[] = inputs.map((input) => {
    let pointsEarned = 0;
    const secondsOver = Math.max(0, input.timeSeconds - input.windowSeconds);

    if (input.skipped) {
      pointsEarned = -20 - Math.floor(secondsOver);
    } else if (input.timeSeconds <= input.windowSeconds) {
      pointsEarned = 20;
    } else {
      pointsEarned = 20 - Math.floor(secondsOver);
    }

    return {
      name: input.name,
      success: !input.skipped && input.timeSeconds <= input.windowSeconds,
      skipped: input.skipped,
      timeSeconds: input.timeSeconds,
      windowSeconds: input.windowSeconds,
      secondsOver,
      pointsEarned,
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
  for (const r of commandResults) {
    if (!r.skipped && r.timeSeconds <= r.windowSeconds) {
      currentStreak++;
      maxConsecutive = Math.max(maxConsecutive, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  if (maxConsecutive >= 3) {
    bonuses.push({ name: "combo_streak", label: "Combo Streak", points: Math.floor(rawScore * 0.5) });
  }

  if (noSkips) {
    bonuses.push({ name: "clean_sweep", label: "Clean Sweep", points: 10 });
  }

  const diffBonus = DIFFICULTY_COMPLETION_BONUS[difficulty];
  if (diffBonus > 0) {
    bonuses.push({ name: "difficulty_bonus", label: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Mode`, points: diffBonus });
  }

  const totalBonusRaw = bonuses.reduce((sum, b) => sum + b.points, 0);
  const totalBonus = Math.min(totalBonusRaw, 50);

  const totalRaw = rawScore + totalBonus;

  let participationPoints: number;
  if (difficulty === "expert") {
    participationPoints = totalRaw;
  } else {
    participationPoints = Math.max(0, totalRaw);
  }

  return { rawScore: totalRaw, participationPoints, bonuses, commandResults };
}

export const ALL_COMMANDS = ["Sit", "Down", "Stay", "Come", "Heel", "Place", "Leave it"];
