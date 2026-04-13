import { useApp } from "@/context/AppContext";

export const ACHIEVEMENT_DEFS = [
  { type: "first_session",   label: "Starter",          icon: "star"     },
  { type: "streak_7",        label: "7-Day Streak",      icon: "zap"      },
  { type: "streak_30",       label: "30-Day Streak",     icon: "award"    },
  { type: "amazing_student", label: "Amazing Student",   icon: "book"     },
  { type: "distinction_student", label: "Distinction Student", icon: "book-open" },
  { type: "perfect_round",   label: "Perfect Round",     icon: "target"   },
  { type: "speed_demon",     label: "Speed Demon",       icon: "wind"     },
  { type: "family_champion", label: "Family Champ",      icon: "trophy"   },
  { type: "reliable_handler",label: "Reliable Handler",  icon: "shield"   },
  { type: "full_pack",       label: "Full Pack",         icon: "package"  },
  { type: "month_pawfect",   label: "Month Pawfect",     icon: "calendar" },
];

const BASIC_COMMANDS = ["Sit", "Down", "Stay", "Come", "Heel", "Place", "Leave it"];

export function useAchievements() {
  const { commands, streak, seenAchievements } = useApp();

  const level3Count = commands.filter(
    (c) => c.level >= 3 || (c.qbSuccessesCount >= 10 && c.qbSessionsWithSuccess >= 3)
  ).length;
  const hasAnySessions = commands.some((c) => c.trainingSessionsCount > 0 || c.qbSuccessesCount > 0);
  const maxReps = commands.reduce((m, c) => Math.max(m, c.trainingSessionsCount + c.qbSuccessesCount), 0);
  const basicAt100 = BASIC_COMMANDS.filter((name) => {
    const cmd = commands.find((c) => c.name === name);
    return cmd && (cmd.trainingSessionsCount + cmd.qbSuccessesCount) >= 100;
  }).length;

  const unlocked = new Set<string>();
  if (hasAnySessions) unlocked.add("first_session");
  if (streak >= 7)     unlocked.add("streak_7");
  if (streak >= 30)    unlocked.add("streak_30");
  if (level3Count >= 1) unlocked.add("reliable_handler");
  if (level3Count >= 7) unlocked.add("full_pack");
  if (maxReps >= 100)  unlocked.add("amazing_student");
  if (basicAt100 >= 7) unlocked.add("distinction_student");

  /** Returns defs for achievements that are newly unlocked (not yet seen). */
  const getNewlyUnlocked = () =>
    ACHIEVEMENT_DEFS.filter((a) => unlocked.has(a.type) && !seenAchievements.includes(a.type));

  return { unlocked, getNewlyUnlocked };
}
