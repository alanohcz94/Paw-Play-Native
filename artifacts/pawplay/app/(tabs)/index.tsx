import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

function StatCard({
  label,
  value,
  bg,
}: {
  label: string;
  value: string | number;
  bg: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text
        style={[
          styles.statValue,
          { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { dog, streak, familyId } = useApp();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [daysThisWeek, setDaysThisWeek] = useState(0);
  const [trainedDays, setTrainedDays] = useState<number[]>([]);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";

  const loadData = async () => {
    if (!dog?.id || !user?.id) return;
    try {
      const { getItemAsync } = await import("expo-secure-store");
      const token = await getItemAsync("auth_session_token");
      const headers = { Authorization: `Bearer ${token}` };

      const res = await fetch(
        `${apiBase}/api/sessions?dogId=${dog.id}&limit=50`,
        { headers },
      );
      if (res.ok) {
        const { sessions: s } = await res.json();
        setSessions(s);

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        startOfWeek.setHours(0, 0, 0, 0);

        const thisWeekDays = new Set<number>();
        for (const sess of s) {
          const d = new Date(sess.createdAt);
          if (d >= startOfWeek) {
            const dayOfWeek = (d.getDay() + 6) % 7;
            thisWeekDays.add(dayOfWeek);
          }
        }
        setDaysThisWeek(thisWeekDays.size);
        setTrainedDays(Array.from(thisWeekDays));
      }

      if (familyId) {
        const lbRes = await fetch(
          `${apiBase}/api/family/${familyId}/leaderboard`,
          { headers },
        );
        if (lbRes.ok) {
          const { entries } = await lbRes.json();
          setLeaderboard(entries);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [dog?.id, familyId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalHours =
    sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 3600;
  const totalPoints = sessions.reduce(
    (sum, s) => sum + (s.participationPoints || 0),
    0,
  );

  const todaySessions = sessions.filter((s) => {
    const d = new Date(s.createdAt);
    return d.toDateString() === new Date().toDateString();
  });

  const topPaddingStyle = {
    paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          topPaddingStyle,
          { paddingBottom: 100 + (Platform.OS === "web" ? 34 : insets.bottom) },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity>
            <Feather name="menu" size={24} color={colors.dark} />
          </TouchableOpacity>
          <Text
            style={[
              styles.greeting,
              { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
            ]}
          >
            {dog ? `${dog.name}'s Day` : "Welcome!"}
          </Text>
          {streak > 0 ? (
            <View
              style={[styles.streakPill, { backgroundColor: colors.peach }]}
            >
              <Feather name="zap" size={14} color="#fff" />
              <Text
                style={[styles.streakText, { fontFamily: "Nunito_900Black" }]}
              >
                {streak}d
              </Text>
            </View>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Sessions this week"
            value={daysThisWeek}
            bg={colors.peachLight}
          />
          <StatCard
            label="Training hours"
            value={totalHours.toFixed(1)}
            bg={colors.mintLight}
          />
          <StatCard
            label="Total points"
            value={totalPoints}
            bg={colors.lemonLight}
          />
        </View>

        {/* Today history log */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>
              Today
            </Text>
            {todaySessions.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.peachLight }]}>
                <Text style={[styles.countBadgeText, { color: colors.peach, fontFamily: "Nunito_900Black" }]}>
                  {todaySessions.length}
                </Text>
              </View>
            )}
          </View>
          {todaySessions.length === 0 ? (
            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
              No activity yet today
            </Text>
          ) : (
            todaySessions.map((s: any, i: number) => {
              const isQB = s.mode === "quickbites" || s.mode === "challenge";
              const modeLabel = isQB ? "Quick Bites" : "Training";
              const modeIcon = isQB ? "zap" : "book-open";
              return (
                <View key={s.id ?? i} style={[styles.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Feather name={modeIcon as any} size={16} color={isQB ? colors.peach : colors.mint} />
                  <Text style={[styles.historyLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
                    {modeLabel}
                  </Text>
                  {s.difficulty && (
                    <View style={[styles.diffChip, { backgroundColor: colors.lavLight }]}>
                      <Text style={[styles.diffChipText, { color: colors.lavender, fontFamily: "Nunito_700Bold" }]}>
                        {s.difficulty}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.historyPts, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
                    {s.participationPoints > 0 ? `+${s.participationPoints} pts` : ""}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              { color: colors.dark, fontFamily: "Nunito_900Black" },
            ]}
          >
            This week
          </Text>
          <Text
            style={[
              styles.weekLabel,
              { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
            ]}
          >
            {daysThisWeek} of 7 days
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(daysThisWeek / 7) * 100}%`,
                  backgroundColor: colors.lavender,
                },
              ]}
            />
          </View>
          <View style={styles.weekDays}>
            {WEEK_DAYS.map((day, i) => (
              <View key={i} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayDot,
                    {
                      backgroundColor: trainedDays.includes(i)
                        ? colors.mint
                        : colors.muted,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.dayLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Nunito_700Bold",
                    },
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: colors.skyLight, borderColor: colors.border },
          ]}
          onPress={() => router.push("/calendar")}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              Calendar
            </Text>
            <Feather
              name="chevron-right"
              size={20}
              color={colors.mutedForeground}
            />
          </View>
          <Text
            style={[
              styles.cardSubtitle,
              {
                color: colors.mutedForeground,
                fontFamily: "Nunito_400Regular",
              },
            ]}
          >
            View full training history
          </Text>
        </TouchableOpacity>

        {leaderboard.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.skyLight, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              Family Leaderboard
            </Text>
            {leaderboard.map((entry, i) => (
              <View key={entry.userId} style={styles.leaderboardRow}>
                <Text
                  style={[
                    styles.rankText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Nunito_700Bold",
                    },
                  ]}
                >
                  {i === 0 ? "👑" : `#${i + 1}`}
                </Text>
                <Text
                  style={[
                    styles.memberName,
                    { color: colors.dark, fontFamily: "Nunito_700Bold" },
                  ]}
                >
                  {entry.displayName}
                </Text>
                <Text
                  style={[
                    styles.memberPoints,
                    { color: colors.peach, fontFamily: "Nunito_900Black" },
                  ]}
                >
                  {entry.totalPoints} pts
                </Text>
              </View>
            ))}
          </View>
        )}

        {sessions.length === 0 && (
          <View
            style={[styles.emptyCard, { backgroundColor: colors.lavLight }]}
          >
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              No sessions yet!
            </Text>
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Nunito_400Regular",
                },
              ]}
            >
              Start your first training session to see your stats here.
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.peach }]}
        onPress={() => router.push("/challenge-setup")}
        activeOpacity={0.85}
      >
        <Feather name="play" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  greeting: { fontSize: 22 },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakText: { color: "#fff", fontSize: 13 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 24 },
  statLabel: { fontSize: 11, textAlign: "center" },
  card: { borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, marginBottom: 8 },
  cardSubtitle: { fontSize: 13 },
  weekLabel: { fontSize: 14, marginBottom: 8 },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: { height: "100%", borderRadius: 4 },
  weekDays: { flexDirection: "row", justifyContent: "space-between" },
  dayCell: { alignItems: "center", gap: 4 },
  dayDot: { width: 10, height: 10, borderRadius: 5 },
  dayLabel: { fontSize: 11 },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  rankText: { fontSize: 18, width: 30, textAlign: "center" },
  memberName: { flex: 1, fontSize: 15 },
  memberPoints: { fontSize: 15 },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  countBadgeText: { fontSize: 13 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  historyLabel: { flex: 1, fontSize: 14 },
  diffChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  diffChipText: { fontSize: 11, textTransform: "capitalize" as const },
  historyPts: { fontSize: 13 },
  fab: {
    position: "absolute",
    bottom: 90,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8B6A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
