import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

export type FeatherIconName = ComponentProps<typeof Feather>["name"];

export interface Session {
  id: string;
  userId: string;
  mode: "quickbites" | "blitz" | "training";
  difficulty?: string | null;
  rawScore: number;
  participationPoints: number;
  durationSeconds?: number | null;
  commandsUsed: { name: string }[];
  completed: boolean;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalPoints: number;
  sessionCount: number;
}
