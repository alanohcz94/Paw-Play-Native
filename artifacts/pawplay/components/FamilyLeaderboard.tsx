import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { LeaderboardEntry } from "@/types/api";

const RANK_COLORS: Record<number, string> = {
  0: "#FFB800",
  1: "#A8A9AD",
  2: "#CD7F32",
};

const TIER_EMOJI: Record<string, string> = {
  gold: "🥇",
  silver: "🥈",
  bronze: "🥉",
  paw: "🐾",
};

type Tab = "points" | "streak";

function LeaderboardRow({
  entry,
  rank,
  isMe,
  tab,
}: {
  entry: LeaderboardEntry;
  rank: number;
  isMe: boolean;
  tab: Tab;
}) {
  const colors = useColors();
  const rankBg = RANK_COLORS[rank] ?? "transparent";
  const isTop3 = rank < 3;
  const nameLabel = entry.dogName
    ? `${entry.dogName} (${entry.displayName})`
    : entry.displayName;
  const subtitle =
    tab === "streak"
      ? `${entry.streak}d streak`
      : `${entry.daysTrainedThisWeek} day${entry.daysTrainedThisWeek !== 1 ? "s" : ""} this week`;

  return (
    <View
      style={[
        styles.row,
        {
          marginTop: 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 8,
          backgroundColor: isMe ? colors.peachLight : "transparent",
        },
      ]}
    >
      <View style={{ position: "relative" }}>
        <View style={[styles.rankBadge, { backgroundColor: rankBg }]}>
          <Text
            style={[
              styles.rankText,
              {
                color: isTop3 ? "#fff" : colors.mutedForeground,
                fontFamily: "Nunito_700Bold",
              },
            ]}
          >
            {rank + 1}
          </Text>
        </View>
        {isTop3 && (
          <View style={styles.crownBadge}>
            <Text style={styles.crownText}>👑</Text>
          </View>
        )}
      </View>

      <View style={[styles.memberInfo, { marginLeft: 10 }]}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.memberName,
              { color: colors.dark, fontFamily: "Nunito_700Bold" },
            ]}
            numberOfLines={1}
          >
            {nameLabel}
            {isMe ? " (you)" : ""}
          </Text>
          <Text style={styles.tierEmoji}>{TIER_EMOJI[entry.tier]}</Text>
        </View>
        <Text
          style={[
            styles.memberStreak,
            { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      <View style={styles.pointsContainer}>
        {tab === "points" ? (
          <>
            <Text
              style={[
                styles.memberPoints,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              {entry.totalPoints.toLocaleString()}
            </Text>
            <Text
              style={[
                styles.pointsLabel,
                { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
              ]}
            >
              pts
            </Text>
          </>
        ) : (
          <>
            <Text
              style={[
                styles.memberPoints,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              {entry.streak}
            </Text>
            <Text
              style={[
                styles.pointsLabel,
                { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
              ]}
            >
              days
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

export default function FamilyLeaderboard({
  leaderboard,
  currentUserId,
}: {
  leaderboard: LeaderboardEntry[];
  currentUserId?: string;
}) {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>("points");

  const sorted = useMemo(() => {
    if (tab === "streak") {
      return [...leaderboard].sort((a, b) => b.streak - a.streak);
    }
    return leaderboard;
  }, [leaderboard, tab]);

  if (leaderboard.length === 0) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[
            styles.cardTitle,
            { color: colors.dark, fontFamily: "Nunito_900Black" },
          ]}
        >
          Friends Leaderboard
        </Text>
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              tab === "points" && { backgroundColor: colors.card },
            ]}
            onPress={() => setTab("points")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    tab === "points" ? colors.dark : colors.mutedForeground,
                  fontFamily:
                    tab === "points" ? "Nunito_700Bold" : "Nunito_400Regular",
                },
              ]}
            >
              Points
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              tab === "streak" && { backgroundColor: colors.card },
            ]}
            onPress={() => setTab("streak")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    tab === "streak" ? colors.dark : colors.mutedForeground,
                  fontFamily:
                    tab === "streak" ? "Nunito_700Bold" : "Nunito_400Regular",
                },
              ]}
            >
              Streak
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {sorted.map((entry, i) => (
        <LeaderboardRow
          key={entry.userId}
          entry={entry}
          rank={i}
          isMe={entry.userId === currentUserId}
          tab={tab}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16 },
  tabRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tabText: { fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 14 },
  crownBadge: {
    position: "absolute",
    top: -15,
    left: "45%",
    transform: [{ translateX: -10 }],
  },
  crownText: { fontSize: 18, lineHeight: 22 },
  memberInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  memberName: { fontSize: 14, flexShrink: 1 },
  tierEmoji: { fontSize: 13 },
  memberStreak: { fontSize: 12, marginTop: 1 },
  pointsContainer: { alignItems: "flex-end" },
  memberPoints: { fontSize: 16 },
  pointsLabel: { fontSize: 11, marginTop: 1 },
});
