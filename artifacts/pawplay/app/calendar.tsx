import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
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
  trainedByFamily: boolean;
  sessionCount: number;
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { familyId } = useApp();
  const { user } = useAuth();
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  const loadCalendar = async () => {
    if (!familyId) return;
    try {
      const { getItemAsync } = await import("expo-secure-store");
      const token = await getItemAsync("auth_session_token");
      const res = await fetch(`${apiBase}/api/family/${familyId}/calendar?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  useEffect(() => { loadCalendar(); }, [month, year, familyId]);

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = now.toISOString().split("T")[0];

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

  const getDotColor = (data: CalendarDay | undefined, day: number): string => {
    if (!data) return "transparent";
    if (data.trainedByMe && data.trainedByFamily) return colors.lemon;
    if (data.trainedByMe) return colors.mint;
    if (data.trainedByFamily) return colors.peach;
    return "transparent";
  };

  const isToday = (day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` === today;
  const isFuture = (day: number) => new Date(year, month - 1, day) > now;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

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
          const dotColor = getDotColor(data, day);
          const today = isToday(day);
          const future = isFuture(day);

          return (
            <View
              key={day}
              style={[
                styles.dayCell,
                today && { borderWidth: 2, borderColor: colors.peach, borderRadius: 10 },
                !data?.trainedByMe && !data?.trainedByFamily && !today && !future && { backgroundColor: `${colors.muted}40` },
              ]}
            >
              <Text style={[styles.dayNum, { color: future ? colors.mutedForeground : colors.dark, fontFamily: "Nunito_700Bold", opacity: future ? 0.4 : 1 }]}>{day}</Text>
              {dotColor !== "transparent" && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        {[
          { color: colors.mint, label: "Your session" },
          { color: colors.peach, label: "Family session" },
          { color: colors.lemon, label: "Both trained" },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>{label}</Text>
          </View>
        ))}
      </View>

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
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, gap: 4 },
  statValue: { fontSize: 24 },
  statLabel: { fontSize: 12 },
});
