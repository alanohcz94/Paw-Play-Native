import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { LeaderboardEntry } from "@/types/api";

const RANK_COLORS: Record<number, string> = {
  0: "#FFB800",
  1: "#A8A9AD",
  2: "#CD7F32",
};

function LeaderboardRow({
  entry,
  rank,
  isMe,
}: {
  entry: LeaderboardEntry;
  rank: number;
  isMe: boolean;
}) {
  const colors = useColors();
  const rankBg = RANK_COLORS[rank] ?? "transparent";
  const isTop3 = rank < 3;

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
        <Text
          style={[
            styles.memberName,
            { color: colors.dark, fontFamily: "Nunito_700Bold" },
          ]}
        >
          {entry.displayName}
          {isMe ? " (you)" : ""}
        </Text>
        <Text
          style={[
            styles.memberStreak,
            { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
          ]}
        >
          {entry.sessionCount} session{entry.sessionCount === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={styles.pointsContainer}>
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
          points
        </Text>
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
      </View>

      {leaderboard.map((entry, i) => (
        <LeaderboardRow
          key={entry.userId}
          entry={entry}
          rank={i}
          isMe={entry.userId === currentUserId}
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
    marginBottom: 4,
  },
  cardTitle: { fontSize: 16, marginBottom: 8 },
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
  memberName: { fontSize: 15 },
  memberStreak: { fontSize: 12, marginTop: 1 },
  pointsContainer: { alignItems: "flex-end" },
  memberPoints: { fontSize: 16 },
  pointsLabel: { fontSize: 11, marginTop: 1 },
});
