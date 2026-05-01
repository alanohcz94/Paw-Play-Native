import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ACHIEVEMENT_TYPES } from "@/lib/achievements";
import type { FeatherIconName } from "@/types/api";

const BASIC_COMMANDS = [
  "Sit",
  "Down",
  "Stay",
  "Come",
  "Heel",
  "Place",
  "Leave it",
];

function getProgress(
  type: string,
  streak: number,
  level3Count: number,
  hasAnySessions: boolean,
  maxCommandReps: number,
  basicCommandsAt100: number,
): { pct: number; hint: string } {
  switch (type) {
    case "first_session":
      return hasAnySessions
        ? { pct: 100, hint: "Done!" }
        : { pct: 0, hint: "0/1 sessions" };
    case "streak_7":
      return {
        pct: Math.min(100, Math.round((streak / 7) * 100)),
        hint: `${streak}/7 days`,
      };
    case "streak_14":
      return {
        pct: Math.min(100, Math.round((streak / 14) * 100)),
        hint: `${streak}/14 days`,
      };
    case "streak_30":
      return {
        pct: Math.min(100, Math.round((streak / 30) * 100)),
        hint: `${streak}/30 days`,
      };
    case "reliable_handler":
      return level3Count >= 1
        ? { pct: 100, hint: "Done!" }
        : { pct: 0, hint: "0/1 commands" };
    case "amazing_student":
      return {
        pct: Math.min(100, Math.round((maxCommandReps / 100) * 100)),
        hint: `${maxCommandReps}/100 reps`,
      };
    case "distinction_student":
      return {
        pct: Math.min(100, Math.round((basicCommandsAt100 / 7) * 100)),
        hint: `${basicCommandsAt100}/7 commands`,
      };
    default:
      return { pct: 0, hint: "Complete a session to progress" };
  }
}

export default function AchievementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { commands, streak, dog } = useApp();

  const {
    level3Count,
    hasAnySessions,
    maxCommandReps,
    basicCommandsAt100,
    unlockedSet,
    unlockedCount,
  } = useMemo(() => {
    const level3Count = commands.filter(
      (c) =>
        c.level >= 3 ||
        (c.qbSuccessesCount >= 10 && c.qbSessionsWithSuccess >= 3),
    ).length;
    const hasAnySessions = commands.some(
      (c) => c.trainingSessionsCount > 0 || c.qbSuccessesCount > 0,
    );
    const maxCommandReps = commands.reduce((max, c) => {
      const total = c.trainingSessionsCount + c.qbSuccessesCount;
      return total > max ? total : max;
    }, 0);
    const basicCommandsAt100 = BASIC_COMMANDS.filter((name) => {
      const cmd = commands.find((c) => c.name === name);
      return cmd && cmd.trainingSessionsCount + cmd.qbSuccessesCount >= 100;
    }).length;
    const unlockedSet = new Set<string>();
    if (hasAnySessions) unlockedSet.add("first_session");
    if (streak >= 7) unlockedSet.add("streak_7");
    if (streak >= 30) unlockedSet.add("streak_30");
    if (level3Count >= 1) unlockedSet.add("reliable_handler");
    if (maxCommandReps >= 100) unlockedSet.add("amazing_student");
    if (basicCommandsAt100 >= 7) unlockedSet.add("distinction_student");
    return {
      level3Count,
      hasAnySessions,
      maxCommandReps,
      basicCommandsAt100,
      unlockedSet,
      unlockedCount: unlockedSet.size,
    };
  }, [commands, streak]);

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
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={22} color={colors.dark} />
      </TouchableOpacity>

      <Text
        style={[
          styles.header,
          { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
        ]}
      >
        Achievements
      </Text>

      <View
        style={[
          styles.summaryRow,
          { backgroundColor: colors.mintLight, borderColor: colors.mint },
        ]}
      >
        <View style={[styles.summaryBadge, { backgroundColor: colors.mint }]}>
          <Text
            style={[
              styles.summaryCount,
              { fontFamily: "FredokaOne_400Regular" },
            ]}
          >
            {unlockedCount}
          </Text>
        </View>
        <Text
          style={[
            styles.summaryText,
            { color: colors.dark, fontFamily: "Nunito_700Bold" },
          ]}
        >
          of {ACHIEVEMENT_TYPES.length} achievements unlocked
        </Text>
      </View>

      {ACHIEVEMENT_TYPES.map((ach) => {
        const unlocked = unlockedSet.has(ach.type);
        const { pct, hint } = unlocked
          ? { pct: 100, hint: "Unlocked!" }
          : getProgress(
              ach.type,
              streak,
              level3Count,
              hasAnySessions,
              maxCommandReps,
              basicCommandsAt100,
            );

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
                name={ach.icon as FeatherIconName}
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
                  <Feather
                    name="lock"
                    size={12}
                    color={colors.mutedForeground}
                  />
                )}
                {unlocked && (
                  <Feather name="check-circle" size={14} color={colors.mint} />
                )}
              </View>

              <Text
                style={[
                  styles.cardDesc,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Nunito_400Regular",
                  },
                ]}
              >
                {unlocked ? ach.description : ach.unlock}
              </Text>

              <View style={styles.progressRow}>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: colors.muted },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: unlocked
                          ? colors.mint
                          : colors.lavender,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.progressHint,
                    {
                      color: unlocked ? colors.mint : colors.mutedForeground,
                      fontFamily: "Nunito_700Bold",
                    },
                  ]}
                >
                  {hint}
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
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressHint: { fontSize: 11, minWidth: 60, textAlign: "right" },
});
