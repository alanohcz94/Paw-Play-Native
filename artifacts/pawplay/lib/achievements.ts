import type { FeatherIconName } from "@/types/api";

export type AchievementType = {
  type: string;
  label: string;
  icon: FeatherIconName;
  description: string;
  unlock: string;
};

export const ACHIEVEMENT_TYPES: AchievementType[] = [
  {
    type: "first_session",
    label: "Starter",
    icon: "star",
    description: "Completed your first session",
    unlock: "Complete 1 Quick Bites or Training session or Blitz session",
  },
  {
    type: "streak_7",
    label: "7-Day Streak",
    icon: "zap",
    description: "Trained with your dog 7 days in a row",
    unlock: "Train every day for 7 consecutive days",
  },
  {
    type: "streak_14",
    label: "14-Day Streak",
    icon: "zap",
    description: "Trained with your dog 14 days in a row",
    unlock: "Train every day for 14 consecutive days",
  },
  {
    type: "streak_30",
    label: "30-Day Streak",
    icon: "award",
    description: "A month of consistent daily training",
    unlock: "Train every day for 30 consecutive days",
  },
  {
    type: "amazing_student",
    label: "Amazing Student",
    icon: "book",
    description: "100 reps on any single command — your dog is a natural!",
    unlock: "Reach 100 combined reps on any one command",
  },
  {
    type: "distinction_student",
    label: "Distinction Student",
    icon: "book-open",
    description: "100 reps on every basic command — top of the class!",
    unlock: "Reach 100 combined reps on all 7 basic commands",
  },
  {
    type: "friend_champion",
    label: "Big Win Champ",
    icon: "trophy",
    description: "Top of the leaderboard once against all your friends",
    unlock: "Beat all friends session scores once",
  },
  {
    type: "reliable_handler",
    label: "Reliable Handler",
    icon: "shield",
    description: "Your first command reached Reliable level",
    unlock: "Get any command to Level 3 — Reliable",
  },
  {
    type: "month_pawfect",
    label: "Month Pawfect",
    icon: "calendar",
    description: "Trained every single day this month",
    unlock: "Complete a session every day in a calendar month",
  },
];
