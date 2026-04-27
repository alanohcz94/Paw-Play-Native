import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarDay {
  date: string;
  trainedByMe: boolean;
  trainedByFriends: boolean;
  sessionCount: number;
}

interface SessionRecord {
  id: string;
  mode: string;
  difficulty: string | null;
  participationPoints: number | null;
  commandsUsed: Array<{ name: string; success?: boolean; skipped?: boolean; count?: number }>;
  createdAt: string;
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { dog } = useApp();
  const { user } = useAuth();
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [daySessions, setDaySessions] = useState<SessionRecord[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  const loadCalendar = async () => {
    if (!user?.id) return;
    try {
      const { authedFetch } = await import("@/lib/authedFetch");
      const res = await authedFetch(`/api/calendar?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarData(data.days);
        setTotalSessions(data.totalSessions);
        setTotalHours(data.totalHours);
        setAvgScore(data.avgScore);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadDaySessions = async (dateStr: string) => {
    if (!dog?.id) return;
    setLoadingDay(true);
    setDaySessions([]);
    try {
      const { authedFetch } = await import("@/lib/authedFetch");
      const res = await authedFetch(`/api/sessions?dogId=${dog.id}&date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setDaySessions(data.sessions ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleDayPress = (day: number) => {
    const future = new Date(year, month - 1, day) > now;
    if (future) return;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (selectedDay === dateStr) {
      setSelectedDay(null);
      setDaySessions([]);
    } else {
      setSelectedDay(dateStr);
      loadDaySessions(dateStr);
    }
  };

  useEffect(() => { loadCalendar(); }, [month, year, user?.id]);

  // Clear selected day when navigating months
  useEffect(() => { setSelectedDay(null); setDaySessions([]); }, [month, year]);

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = now.toISOString().split("T")[0];

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const getDayData = (day: number): CalendarDay | undefined => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return calendarData.find((d) => d.date === dateStr);
  };

  const getDotColor = (data: CalendarDay | undefined): string => {
    if (!data) return "transparent";
    if (data.trainedByMe && data.trainedByFriends) return colors.lemon;
    if (data.trainedByMe) return colors.mint;
    if (data.trainedByFriends) return colors.peach;
    return "transparent";
  };

  const isToday = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` === todayStr;
  const isFuture = (day: number) => new Date(year, month - 1, day) > now;
  const isSelected = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` === selectedDay;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const modeLabel = (mode: string) => {
    if (mode === "quickbites") return "Quick Bites";
    if (mode === "training") return "Training";
    return mode.charAt(0).toUpperCase() + mode.slice(1);
  };

  const modeIcon = (mode: string): string => {
    if (mode === "quickbites") return "zap";
    if (mode === "training") return "book";
    return "activity";
  };

  const diffColor = (diff: string | null) => {
    if (diff === "easy") return { bg: colors.mintLight, fg: colors.mint };
    if (diff === "medium") return { bg: colors.lemonLight, fg: colors.lemon };
    if (diff === "expert") return { bg: colors.peachLight, fg: colors.peach };
    return { bg: colors.muted, fg: colors.mutedForeground };
  };

  const selectedDateLabel = selectedDay
    ? new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24), paddingBottom: 60 + (Platform.OS === "web" ? 34 : insets.bottom) }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
        <Feather name="arrow-left" size={22} color={colors.dark} />
      </TouchableOpacity>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} activeOpacity={0.7}><Feather name="chevron-left" size={24} color={colors.dark} /></TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} activeOpacity={0.7}><Feather name="chevron-right" size={24} color={colors.dark} /></TouchableOpacity>
      </View>

      <View style={styles.dayHeaders}>
        {DAY_NAMES.map((d) => (
          <Text key={d} style={[styles.dayHeader, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`empty-${i}`} style={styles.dayCell} />;
          const data = getDayData(day);
          const dotColor = getDotColor(data);
          const todayCell = isToday(day);
          const future = isFuture(day);
          const selected = isSelected(day);

          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayCell,
                todayCell && { borderWidth: 2, borderColor: colors.peach, borderRadius: 10 },
                selected && { backgroundColor: colors.lavLight, borderRadius: 10 },
                !data?.trainedByMe && !data?.trainedByFriends && !todayCell && !future && { backgroundColor: `${colors.muted}40` },
              ]}
              onPress={() => handleDayPress(day)}
              activeOpacity={future ? 1 : 0.7}
              disabled={future}
            >
              <Text style={[styles.dayNum, { color: future ? colors.mutedForeground : selected ? colors.lavender : colors.dark, fontFamily: "Nunito_700Bold", opacity: future ? 0.4 : 1 }]}>{day}</Text>
              {dotColor !== "transparent" && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        {[
          { color: colors.mint, label: "Your session" },
          { color: colors.peach, label: "Friend's session" },
          { color: colors.lemon, label: "Both trained" },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Day detail panel */}
      {selectedDay && (
        <View style={[styles.dayDetail, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dayDetailHeader}>
            <Text style={[styles.dayDetailTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>
              {selectedDateLabel}
            </Text>
            <TouchableOpacity onPress={() => { setSelectedDay(null); setDaySessions([]); }} activeOpacity={0.7}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {loadingDay ? (
            <ActivityIndicator color={colors.mint} style={{ marginVertical: 16 }} />
          ) : daySessions.length === 0 ? (
            <Text style={[styles.emptyDayText, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
              No sessions recorded on this day.
            </Text>
          ) : (
            daySessions.map((s, idx) => {
              const dc = diffColor(s.difficulty);
              const pts = s.participationPoints ?? 0;
              const totalReps = s.commandsUsed.reduce((sum, c) => sum + (c.count ?? 1), 0);
              return (
                <View
                  key={s.id ?? idx}
                  style={[
                    styles.sessionRow,
                    idx < daySessions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.sessionIconBadge, { backgroundColor: dc.bg }]}>
                    <Feather name={modeIcon(s.mode) as any} size={16} color={dc.fg} />
                  </View>
                  <View style={styles.sessionBody}>
                    <View style={styles.sessionTitleRow}>
                      <Text style={[styles.sessionMode, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
                        {modeLabel(s.mode)}
                      </Text>
                      {s.difficulty && (
                        <View style={[styles.diffChip, { backgroundColor: dc.bg }]}>
                          <Text style={[styles.diffChipText, { color: dc.fg, fontFamily: "Nunito_700Bold" }]}>
                            {s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.sessionMeta}>
                      <Text style={[styles.sessionReps, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
                        {totalReps} {totalReps === 1 ? "rep" : "reps"}
                      </Text>
                      {s.commandsUsed.length > 0 && (
                        <Text style={[styles.sessionCmds, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]} numberOfLines={1}>
                          · {s.commandsUsed.map((c) => c.name).join(", ")}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.sessionPts, { color: pts >= 0 ? colors.mint : "#ef4444", fontFamily: "Nunito_900Black" }]}>
                    {pts >= 0 ? "+" : ""}{pts}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{totalSessions}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Sessions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{totalHours.toFixed(1)}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Hours</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{avgScore}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Avg Score</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  backBtn: { marginBottom: 16, alignSelf: "flex-start" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  monthTitle: { fontSize: 24 },
  dayHeaders: { flexDirection: "row", marginBottom: 8 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, gap: 2 },
  dayNum: { fontSize: 13 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13 },
  dayDetail: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  dayDetailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  dayDetailTitle: { fontSize: 15 },
  emptyDayText: { fontSize: 14, textAlign: "center", paddingVertical: 12 },
  sessionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10 },
  sessionIconBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sessionBody: { flex: 1, gap: 2 },
  sessionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionMode: { fontSize: 14 },
  sessionMeta: { flexDirection: "row", alignItems: "center", gap: 0 },
  sessionReps: { fontSize: 12 },
  sessionCmds: { fontSize: 12, flex: 1 },
  sessionPts: { fontSize: 15, minWidth: 36, textAlign: "right" },
  diffChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  diffChipText: { fontSize: 11 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, gap: 4 },
  statValue: { fontSize: 24 },
  statLabel: { fontSize: 12 },
});
