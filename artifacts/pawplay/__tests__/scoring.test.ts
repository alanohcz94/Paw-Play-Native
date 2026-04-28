import { calculateScore, type RawCommandInput } from "../utils/scoring";

function cmd(overrides: Partial<RawCommandInput> = {}): RawCommandInput {
  return {
    name: "Sit",
    skipped: false,
    timeSeconds: 2,
    windowSeconds: 4,
    resetCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic point calculation
// ---------------------------------------------------------------------------
describe("calculateScore — individual command points", () => {
  it("awards full points (20) when completed within the window", () => {
    const { commandResults } = calculateScore([cmd({ timeSeconds: 2, windowSeconds: 4 })], "easy");
    expect(commandResults[0].pointsEarned).toBe(20);
    expect(commandResults[0].success).toBe(true);
  });

  it("awards full points when exactly on the window boundary", () => {
    const { commandResults } = calculateScore([cmd({ timeSeconds: 4, windowSeconds: 4 })], "easy");
    expect(commandResults[0].pointsEarned).toBe(20);
    expect(commandResults[0].success).toBe(true);
  });

  it("deducts 1 point per second over the window", () => {
    const { commandResults } = calculateScore([cmd({ timeSeconds: 7, windowSeconds: 4 })], "easy");
    expect(commandResults[0].secondsOver).toBe(3);
    expect(commandResults[0].pointsEarned).toBe(17);
    expect(commandResults[0].success).toBe(false);
  });

  it("awards 0 points for a skip in easy mode", () => {
    const { commandResults } = calculateScore([cmd({ skipped: true })], "easy");
    expect(commandResults[0].pointsEarned).toBe(0);
  });

  it("awards 0 points for a skip in medium mode", () => {
    const { commandResults } = calculateScore([cmd({ skipped: true })], "medium");
    expect(commandResults[0].pointsEarned).toBe(0);
  });

  it("applies a negative penalty for a skip in expert mode", () => {
    const { commandResults } = calculateScore([cmd({ skipped: true, timeSeconds: 0, windowSeconds: 4 })], "expert");
    expect(commandResults[0].pointsEarned).toBe(-20);
  });

  it("adds extra penalty for seconds-over in an expert skip", () => {
    const { commandResults } = calculateScore([cmd({ skipped: true, timeSeconds: 8, windowSeconds: 4 })], "expert");
    expect(commandResults[0].pointsEarned).toBe(-24);
  });

  it("respects a custom maxPoints value", () => {
    const { commandResults } = calculateScore([cmd({ maxPoints: 10, timeSeconds: 1, windowSeconds: 4 })], "easy");
    expect(commandResults[0].pointsEarned).toBe(10);
  });

  it("marks a command as skipped correctly in the result", () => {
    const { commandResults } = calculateScore([cmd({ skipped: true })], "easy");
    expect(commandResults[0].skipped).toBe(true);
    expect(commandResults[0].success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rawScore and participationPoints
// ---------------------------------------------------------------------------
describe("calculateScore — rawScore accumulation", () => {
  it("sums points across multiple commands", () => {
    const inputs = [
      cmd({ name: "Sit", timeSeconds: 2 }),
      cmd({ name: "Down", timeSeconds: 2 }),
      cmd({ name: "Stay", timeSeconds: 2 }),
    ];
    const { rawScore } = calculateScore(inputs, "easy");
    expect(rawScore).toBeGreaterThanOrEqual(60);
  });

  it("handles an empty command list", () => {
    const { rawScore, bonuses, commandResults } = calculateScore([], "easy");
    expect(rawScore).toBe(0);
    expect(commandResults).toHaveLength(0);
    expect(bonuses.some((b) => b.name === "clean_sweep")).toBe(true);
    expect(bonuses.some((b) => b.name === "first_cue")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bonuses
// ---------------------------------------------------------------------------
describe("calculateScore — combo_streak bonus", () => {
  it("does not award combo_streak for fewer than 3 consecutive successes", () => {
    const inputs = [
      cmd({ timeSeconds: 1 }),
      cmd({ timeSeconds: 1 }),
      cmd({ skipped: true }),
    ];
    const { bonuses } = calculateScore(inputs, "easy");
    expect(bonuses.some((b) => b.name === "combo_streak")).toBe(false);
  });

  it("awards combo_streak bonus for 3+ consecutive successes", () => {
    const inputs = [
      cmd({ name: "Sit", timeSeconds: 1 }),
      cmd({ name: "Down", timeSeconds: 1 }),
      cmd({ name: "Stay", timeSeconds: 1 }),
    ];
    const { bonuses } = calculateScore(inputs, "easy");
    const combo = bonuses.find((b) => b.name === "combo_streak");
    expect(combo).toBeDefined();
    expect(combo!.points).toBeGreaterThan(0);
    expect(combo!.label).toBe("Combo Streak");
  });

  it("combo bonus is 50% of the streak commands' raw points", () => {
    const inputs = [
      cmd({ name: "Sit", timeSeconds: 1, windowSeconds: 4 }),
      cmd({ name: "Down", timeSeconds: 1, windowSeconds: 4 }),
      cmd({ name: "Stay", timeSeconds: 1, windowSeconds: 4 }),
    ];
    const { bonuses, commandResults } = calculateScore(inputs, "easy");
    const basePoints = commandResults.reduce((s, r) => s + r.pointsEarned, 0);
    const combo = bonuses.find((b) => b.name === "combo_streak");
    expect(combo!.points).toBe(Math.floor(basePoints * 0.5));
  });
});

describe("calculateScore — clean_sweep bonus", () => {
  it("awards clean_sweep when no commands are skipped", () => {
    const inputs = [cmd(), cmd({ name: "Down" })];
    const { bonuses } = calculateScore(inputs, "easy");
    expect(bonuses.some((b) => b.name === "clean_sweep")).toBe(true);
  });

  it("does not award clean_sweep when at least one command is skipped", () => {
    const inputs = [cmd(), cmd({ name: "Down", skipped: true })];
    const { bonuses } = calculateScore(inputs, "easy");
    expect(bonuses.some((b) => b.name === "clean_sweep")).toBe(false);
  });
});

describe("calculateScore — first_cue bonus", () => {
  it("awards first_cue when all commands have 0 resets", () => {
    const inputs = [cmd({ resetCount: 0 }), cmd({ resetCount: 0, name: "Down" })];
    const { bonuses } = calculateScore(inputs, "easy");
    expect(bonuses.some((b) => b.name === "first_cue")).toBe(true);
  });

  it("does not award first_cue when any command has resets", () => {
    const inputs = [cmd({ resetCount: 0 }), cmd({ resetCount: 1, name: "Down" })];
    const { bonuses } = calculateScore(inputs, "easy");
    expect(bonuses.some((b) => b.name === "first_cue")).toBe(false);
  });

  it("caps first_cue at 15 points regardless of command count", () => {
    const inputs = Array.from({ length: 20 }, (_, i) => cmd({ name: `Cmd${i}`, resetCount: 0 }));
    const { bonuses } = calculateScore(inputs, "easy");
    const fc = bonuses.find((b) => b.name === "first_cue");
    expect(fc!.points).toBe(15);
  });
});

describe("calculateScore — difficulty_bonus", () => {
  it("does not add difficulty_bonus for easy mode", () => {
    const { bonuses } = calculateScore([cmd()], "easy");
    expect(bonuses.some((b) => b.name === "difficulty_bonus")).toBe(false);
  });

  it("adds 10 points difficulty_bonus for medium mode", () => {
    const { bonuses } = calculateScore([cmd()], "medium");
    const diff = bonuses.find((b) => b.name === "difficulty_bonus");
    expect(diff).toBeDefined();
    expect(diff!.points).toBe(10);
  });

  it("adds 25 points difficulty_bonus for expert mode", () => {
    const inputs = [cmd()];
    const { bonuses } = calculateScore(inputs, "expert");
    const diff = bonuses.find((b) => b.name === "difficulty_bonus");
    expect(diff).toBeDefined();
    expect(diff!.points).toBe(25);
  });
});

describe("calculateScore — bonus cap at 50", () => {
  it("caps the total bonus at 50 points", () => {
    // 5 commands in a streak (combo_streak) + clean_sweep + first_cue + expert difficulty
    // should hit the cap easily
    const inputs = Array.from({ length: 5 }, (_, i) => cmd({ name: `Cmd${i}`, timeSeconds: 1, windowSeconds: 10 }));
    const { bonuses } = calculateScore(inputs, "expert");
    const totalBonus = bonuses.reduce((s, b) => s + b.points, 0);
    expect(totalBonus).toBeLessThanOrEqual(50);
  });
});
