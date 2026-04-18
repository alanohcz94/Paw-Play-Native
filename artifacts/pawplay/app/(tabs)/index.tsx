import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Image,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";
import DogPicker from "@/components/DogPicker";

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
  const { dog, dogs, streak, familyId, loadDogsFromApi } = useApp();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [daysThisWeek, setDaysThisWeek] = useState(0);
  const [trainedDays, setTrainedDays] = useState<number[]>([]);
  const dogsLoadedForFamily = useRef<string | null>(null);

  // Clear stale data immediately when the active dog changes
  useEffect(() => {
    setSessions([]);
    setSessionsThisWeek(0);
    setDaysThisWeek(0);
    setTrainedDays([]);
  }, [dog?.id]);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";

  const loadDogs = async () => {
    if (!familyId || !user?.id || dogsLoadedForFamily.current === familyId)
      return;
    await loadDogsFromApi();
    dogsLoadedForFamily.current = familyId;
  };

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
        startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        startOfWeek.setHours(0, 0, 0, 0);

        const thisWeekDays = new Set<number>();
        let weekSessionCount = 0;
        for (const sess of s) {
          const d = new Date(sess.createdAt);
          if (d >= startOfWeek) {
            weekSessionCount++;
            const dayOfWeek = (d.getDay() + 6) % 7;
            thisWeekDays.add(dayOfWeek);
          }
        }
        setSessionsThisWeek(weekSessionCount);
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
      loadDogs();
      loadData();
    }, [dog?.id, familyId]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalMins = useMemo(
    () =>
      Math.round(
        sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60,
      ),
    [sessions],
  );
  const totalPoints = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.participationPoints || 0), 0),
    [sessions],
  );
  const todaySessions = useMemo(() => {
    const todayStr = new Date().toDateString();
    return sessions.filter(
      (s) => new Date(s.createdAt).toDateString() === todayStr,
    );
  }, [sessions]);

  const topPaddingStyle = useMemo(
    () => ({ paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }),
    [insets.top],
  );

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
        <DogPicker />

        <View style={styles.topBar}>
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
            value={sessionsThisWeek}
            bg={colors.peachLight}
          />
          <StatCard
            label="Training mins"
            value={totalMins}
            bg={colors.mintLight}
          />
          <StatCard
            label="Total points"
            value={totalPoints}
            bg={colors.lemonLight}
          />
        </View>

        {/* Today history log */}
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
              Today
            </Text>
            {todaySessions.length > 0 && (
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: colors.peachLight },
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    { color: colors.peach, fontFamily: "Nunito_900Black" },
                  ]}
                >
                  {todaySessions.length}
                </Text>
              </View>
            )}
          </View>
          {todaySessions.length === 0 ? (
            <Text
              style={[
                styles.cardSubtitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Nunito_400Regular",
                },
              ]}
            >
              No activity yet today
            </Text>
          ) : (
            todaySessions.map((s: any, i: number) => {
              const isQB = s.mode === "quickbites" || s.mode === "challenge";
              const modeLabel = isQB ? "Quick Bites" : "Training";
              const modeIcon = isQB ? "zap" : "book-open";
              const cmdName =
                !isQB && s.commandsUsed?.[0]?.name
                  ? s.commandsUsed[0].name
                  : null;
              const reps =
                !isQB && s.durationSeconds
                  ? Math.round(s.durationSeconds / 30)
                  : null;
              return (
                <View
                  key={s.id ?? i}
                  style={[
                    styles.historyRow,
                    i > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={modeIcon as any}
                    size={16}
                    color={isQB ? colors.peach : colors.mint}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.historyLabel,
                        { color: colors.dark, fontFamily: "Nunito_700Bold" },
                      ]}
                    >
                      {modeLabel}
                      {cmdName ? ` — ${cmdName}` : ""}
                    </Text>
                    {reps && reps > 0 && (
                      <Text
                        style={[
                          styles.historyMeta,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Nunito_400Regular",
                          },
                        ]}
                      >
                        {reps} rep{reps !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                  {s.difficulty && (
                    <View
                      style={[
                        styles.diffChip,
                        { backgroundColor: colors.lavLight },
                      ]}
                    >
                      <Text
                        style={[
                          styles.diffChipText,
                          {
                            color: colors.lavender,
                            fontFamily: "Nunito_700Bold",
                          },
                        ]}
                      >
                        {s.difficulty}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.historyPts,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Nunito_700Bold",
                      },
                    ]}
                  >
                    {s.participationPoints > 0
                      ? `+${s.participationPoints} pts`
                      : ""}
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
            { backgroundColor: colors.card, borderColor: colors.border },
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
                Family Leaderboard
              </Text>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: colors.lemonLight },
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    { color: colors.dark, fontFamily: "Nunito_900Black" },
                  ]}
                >
                  {leaderboard.reduce((sum, e) => sum + e.totalPoints, 0)} pts
                </Text>
              </View>
            </View>
            {leaderboard.map((entry, i) => (
              <View
                key={entry.userId}
                style={[
                  styles.leaderboardRow,
                  {
                    marginTop: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginBottom: 8,
                  },
                ]}
              >
                <View style={{ position: "relative" }}>
                  <View
                    style={[
                      styles.rankBadge,
                      {
                        backgroundColor:
                          i === 0
                            ? "#FFB800"
                            : i === 1
                              ? "#A8A9AD"
                              : i === 2
                                ? "#CD7F32"
                                : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankText,
                        {
                          color: i < 3 ? "#fff" : colors.mutedForeground,
                          fontFamily: "Nunito_700Bold",
                        },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  {i < 3 && (
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
                  </Text>
                  <Text
                    style={[
                      styles.memberStreak,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Nunito_400Regular",
                      },
                    ]}
                  >
                    {entry.sessionCount} day streak
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
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Nunito_400Regular",
                      },
                    ]}
                  >
                    points
                  </Text>
                </View>
              </View>
            ))}
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
    gap: 10,
  },
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
    top: 0,
    left: "0%",
    transform: [{ translateX: -10 }],
  },
  crownText: { fontSize: 18, lineHeight: 22 },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 16 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15 },
  memberStreak: { fontSize: 12, marginTop: 1 },
  pointsContainer: { alignItems: "flex-end" },
  memberPoints: { fontSize: 16 },
  pointsLabel: { fontSize: 11, marginTop: 1 },
  emptyCard: { borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  countBadgeText: { fontSize: 13 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  historyLabel: { fontSize: 14 },
  historyMeta: { fontSize: 12, marginTop: 1 },
  diffChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  diffChipText: { fontSize: 11, textTransform: "capitalize" as const },
  historyPts: { fontSize: 13 },
  topAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  topAvatarImage: { width: 32, height: 32, borderRadius: 16 },
  topAvatarEmoji: { fontSize: 18 },
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
