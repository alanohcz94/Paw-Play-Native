import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const ACHIEVEMENT_TYPES = [
  {
    type: "first_session",
    label: "Starter",
    icon: "star",
    description: "Completed your first training session",
    unlock: "Complete 1 Quick Bites or Training session",
  },
  {
    type: "streak_7",
    label: "7-Day Streak",
    icon: "zap",
    description: "Trained with your dog 7 days in a row",
    unlock: "Train every day for 7 consecutive days",
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
    type: "perfect_round",
    label: "Perfect Round",
    icon: "target",
    description: "Flawless session — every command on time",
    unlock: "Complete all commands within the comply window with zero skips",
  },
  {
    type: "speed_demon",
    label: "Speed Demon",
    icon: "wind",
    description: "Lightning fast responses from your dog",
    unlock: "Complete every command in under half the comply window",
  },
  {
    type: "family_champion",
    label: "Family Champ",
    icon: "trophy",
    description: "Top of the family leaderboard",
    unlock: "Beat all family members' session scores",
  },
  {
    type: "reliable_handler",
    label: "Reliable Handler",
    icon: "shield",
    description: "Your first command reached Reliable level",
    unlock: "Get any command to Level 3 — Reliable",
  },
  {
    type: "full_pack",
    label: "Full Pack",
    icon: "package",
    description: "All basic commands mastered — Obedience Challenge unlocked!",
    unlock: "Get all 7 basic commands to Level 3 — Reliable",
  },
  {
    type: "month_pawfect",
    label: "Month Pawfect",
    icon: "calendar",
    description: "Trained every single day this month",
    unlock: "Complete a session every day in a calendar month",
  },
];

const BASIC_COMMANDS = ["Sit", "Down", "Stay", "Come", "Heel", "Place", "Leave it"];

function getProgress(
  type: string,
  streak: number,
  level3Count: number,
  hasAnySessions: boolean,
  commands: Array<{ name: string; trainingSessionsCount: number; qbSuccessesCount: number }>
): number {
  switch (type) {
    case "first_session":
      return hasAnySessions ? 100 : 0;
    case "streak_7":
      return Math.min(100, Math.round((streak / 7) * 100));
    case "streak_30":
      return Math.min(100, Math.round((streak / 30) * 100));
    case "reliable_handler":
      return level3Count >= 1 ? 100 : 0;
    case "full_pack":
      return Math.min(100, Math.round((level3Count / 7) * 100));
    case "amazing_student": {
      const maxReps = commands.reduce((max, c) => {
        const total = c.trainingSessionsCount + c.qbSuccessesCount;
        return total > max ? total : max;
      }, 0);
      return Math.min(100, Math.round((maxReps / 100) * 100));
    }
    case "distinction_student": {
      const basicDone = BASIC_COMMANDS.filter((name) => {
        const cmd = commands.find((c) => c.name === name);
        return cmd && (cmd.trainingSessionsCount + cmd.qbSuccessesCount) >= 100;
      }).length;
      return Math.min(100, Math.round((basicDone / 7) * 100));
    }
    default:
      return 0;
  }
}

function getCommandStatus(cmd: { level: number; trainingSessionsCount: number; qbSuccessesCount: number; qbSessionsWithSuccess: number }) {
  if (cmd.level >= 3 || (cmd.qbSuccessesCount >= 10 && cmd.qbSessionsWithSuccess >= 3)) {
    return { label: "Reliable", barPct: 100, nextInfo: "Mastered!" };
  }
  if (cmd.trainingSessionsCount >= 5) {
    const pct = 40 + Math.min(cmd.qbSuccessesCount / 10, 1) * 60;
    if (cmd.qbSuccessesCount >= 5) {
      return { label: "R1", barPct: pct, nextInfo: `${cmd.qbSuccessesCount}/10 QB to Reliable` };
    }
    return { label: "Practicing", barPct: pct, nextInfo: `${cmd.qbSuccessesCount}/10 QB to Reliable` };
  }
  const pct = Math.min(cmd.trainingSessionsCount / 5, 1) * 40;
  return { label: "Learning", barPct: pct, nextInfo: `${cmd.trainingSessionsCount}/5 sessions to Practicing` };
}

export default function AchievementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { commands, streak, dog } = useApp();

  const level3Count = commands.filter(
    (c) => c.level >= 3 || (c.qbSuccessesCount >= 10 && c.qbSessionsWithSuccess >= 3)
  ).length;
  const hasAnySessions = commands.some(
    (c) => c.trainingSessionsCount > 0 || c.qbSuccessesCount > 0
  );

  const maxCommandReps = commands.reduce((max, c) => {
    const total = c.trainingSessionsCount + c.qbSuccessesCount;
    return total > max ? total : max;
  }, 0);
  const basicCommandsAt100 = BASIC_COMMANDS.filter((name) => {
    const cmd = commands.find((c) => c.name === name);
    return cmd && (cmd.trainingSessionsCount + cmd.qbSuccessesCount) >= 100;
  }).length;

  const unlockedSet = new Set<string>();
  if (hasAnySessions) unlockedSet.add("first_session");
  if (streak >= 7) unlockedSet.add("streak_7");
  if (streak >= 30) unlockedSet.add("streak_30");
  if (level3Count >= 1) unlockedSet.add("reliable_handler");
  if (level3Count >= 7) unlockedSet.add("full_pack");
  if (maxCommandReps >= 100) unlockedSet.add("amazing_student");
  if (basicCommandsAt100 >= 7) unlockedSet.add("distinction_student");

  const unlockedCount = unlockedSet.size;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: 60,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
        <Feather name="arrow-left" size={22} color={colors.dark} />
      </TouchableOpacity>

      <Text style={[styles.header, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>
        Achievements
      </Text>

      <View style={[styles.summaryRow, { backgroundColor: colors.mintLight, borderColor: colors.mint }]}>
        <View style={[styles.summaryBadge, { backgroundColor: colors.mint }]}>
          <Text style={[styles.summaryCount, { fontFamily: "FredokaOne_400Regular" }]}>
            {unlockedCount}
          </Text>
        </View>
        <Text style={[styles.summaryText, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
          of {ACHIEVEMENT_TYPES.length} achievements unlocked
        </Text>
      </View>

      {commands.length > 0 && (
        <View style={[styles.cmdCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cmdCardHeader}>
            <Text style={[styles.cmdCardTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>
              Command Progress
            </Text>
            {dog && (
              <Text style={[styles.cmdDogLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
                {dog.name}{dog.breed ? `: ${dog.breed}` : ""}
              </Text>
            )}
          </View>
          {commands.map((cmd) => {
            const status = getCommandStatus(cmd);
            const barColor =
              status.label === "Reliable" ? colors.mint
              : status.label === "R1" ? colors.mint
              : status.label === "Practicing" ? colors.peach
              : colors.mutedForeground;
            const labelColor =
              status.label === "Reliable" ? colors.mint
              : status.label === "R1" ? colors.mint
              : status.label === "Practicing" ? colors.peach
              : colors.mutedForeground;
            return (
              <View key={cmd.id} style={styles.cmdRow}>
                <View style={styles.cmdRowTop}>
                  <Text style={[styles.cmdName, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
                    {cmd.name}
                  </Text>
                  <Text style={[styles.cmdLevelLabel, { color: labelColor, fontFamily: "Nunito_700Bold" }]}>
                    {status.label}
                  </Text>
                </View>
                <View style={[styles.cmdTrack, { backgroundColor: colors.muted }]}>
                  <View style={[styles.cmdFill, { width: `${status.barPct}%` as any, backgroundColor: barColor }]} />
                </View>
                <Text style={[styles.cmdNextInfo, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
                  {status.nextInfo}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {ACHIEVEMENT_TYPES.map((ach) => {
        const unlocked = unlockedSet.has(ach.type);
        const progress = unlocked
          ? 100
          : getProgress(ach.type, streak, level3Count, hasAnySessions, commands);

        return (
          <View
            key={ach.type}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: unlocked ? colors.mint : colors.border,
                borderWidth: unlocked ? 1.5 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: unlocked ? colors.mintLight : colors.muted },
              ]}
            >
              <Feather
                name={ach.icon as any}
                size={22}
                color={unlocked ? colors.mint : colors.mutedForeground}
              />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text
                  style={[
                    styles.cardLabel,
                    {
                      color: unlocked ? colors.dark : colors.mutedForeground,
                      fontFamily: "Nunito_900Black",
                    },
                  ]}
                >
                  {ach.label}
                </Text>
                {!unlocked && (
                  <Feather name="lock" size={12} color={colors.mutedForeground} />
                )}
                {unlocked && (
                  <Feather name="check-circle" size={14} color={colors.mint} />
                )}
              </View>

              <Text
                style={[
                  styles.cardDesc,
                  { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
                ]}
              >
                {unlocked ? ach.description : ach.unlock}
              </Text>

              <View style={styles.progressRow}>
                <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                        backgroundColor: unlocked ? colors.mint : colors.lavender,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.progressLabel,
                    {
                      color: unlocked ? colors.mint : colors.mutedForeground,
                      fontFamily: "Nunito_700Bold",
                    },
                  ]}
                >
                  {progress}%
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  backBtn: { marginBottom: 12, alignSelf: "flex-start" },
  header: { fontSize: 36, marginBottom: 20 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  summaryBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCount: { color: "#fff", fontSize: 20 },
  summaryText: { fontSize: 15, flex: 1 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  cardLabel: { fontSize: 15 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontSize: 12, width: 32, textAlign: "right" },
  cmdCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    gap: 14,
  },
  cmdCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cmdCardTitle: { fontSize: 17 },
  cmdDogLabel: { fontSize: 13 },
  cmdRow: { gap: 6 },
  cmdRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cmdName: { fontSize: 15 },
  cmdLevelLabel: { fontSize: 13 },
  cmdTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  cmdFill: { height: "100%", borderRadius: 4 },
  cmdNextInfo: { fontSize: 12 },
});
