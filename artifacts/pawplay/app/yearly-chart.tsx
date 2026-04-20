import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthData { month: number; hours: number; sessions: number; }
type Colors = ReturnType<typeof useColors>;

function Bar({ data, maxHours, currentMonth, colors, index }: { data: MonthData; maxHours: number; currentMonth: number; colors: Colors; index: number }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const isCurrent = data.month === currentMonth;
  const isPast = data.month < currentMonth;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 600,
      delay: index * 60,
      useNativeDriver: false,
    }).start();
  }, []);

  const barHeight = maxHours > 0 ? (data.hours / maxHours) * 100 : 0;
  const animHeight = animValue.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${barHeight}%`] });

  return (
    <View style={styles.barWrapper}>
      <View style={styles.barContainer}>
        <Animated.View
          style={[
            styles.bar,
            {
              height: animHeight,
              backgroundColor: isCurrent ? colors.peach : isPast ? colors.peachMid : "transparent",
              borderWidth: isPast || isCurrent ? 0 : 1.5,
              borderColor: colors.border,
              borderStyle: "dashed",
              shadowColor: isCurrent ? colors.peach : "transparent",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isCurrent ? 0.4 : 0,
              shadowRadius: 8,
              elevation: isCurrent ? 4 : 0,
            },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>{MONTH_SHORT[data.month - 1]}</Text>
    </View>
  );
}

export default function YearlyChartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { familyId } = useApp();
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [bestMonth, setBestMonth] = useState<string | null>(null);
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  useEffect(() => {
    if (!familyId) return;
    const load = async () => {
      try {
        const { authedFetch } = await import("@/lib/authedFetch");
        const res = await authedFetch(`/api/family/${familyId}/yearly-chart?year=${year}`);
        if (res.ok) {
          const data = await res.json();
          setMonthsData(data.months);
          setTotalHours(data.totalHours);
          setBestMonth(data.bestMonth);
        }
      } catch (e) {
        console.warn("Failed to load yearly chart data:", e);
      }
    };
    load();
  }, [familyId]);

  const maxHours = monthsData.length > 0 ? Math.max(...monthsData.map((m) => m.hours), 1) : 1;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24), paddingBottom: 60 + (Platform.OS === "web" ? 34 : insets.bottom) }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
        <Feather name="arrow-left" size={22} color={colors.dark} />
      </TouchableOpacity>

      <Text style={[styles.header, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{year}</Text>
      <Text style={[styles.subheader, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Training hours by month</Text>

      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: colors.peachLight }]}>
          <Text style={[styles.statValue, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{totalHours.toFixed(1)}h</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Total hours</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: colors.mintLight }]}>
          <Text style={[styles.statValue, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{bestMonth ?? "—"}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Best month</Text>
        </View>
      </View>

      <View style={[styles.chartContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.chartArea}>
          {monthsData.map((m, i) => (
            <Bar key={m.month} data={m} maxHours={maxHours} currentMonth={currentMonth} colors={colors} index={i} />
          ))}
          {monthsData.length === 0 && Array.from({ length: 12 }, (_, i) => ({ month: i + 1, hours: 0, sessions: 0 })).map((m, i) => (
            <Bar key={m.month} data={m} maxHours={1} currentMonth={currentMonth} colors={colors} index={i} />
          ))}
        </View>
      </View>

      {bestMonth && (
        <View style={[styles.insightCard, { backgroundColor: colors.lavLight }]}>
          <Feather name="trending-up" size={18} color={colors.lavender} />
          <Text style={[styles.insightText, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
            {bestMonth} is your best training month this year!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  backBtn: { marginBottom: 16, alignSelf: "flex-start" },
  header: { fontSize: 36, marginBottom: 4 },
  subheader: { fontSize: 16, marginBottom: 24 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  stat: { flex: 1, borderRadius: 16, padding: 16, gap: 4 },
  statValue: { fontSize: 20 },
  statLabel: { fontSize: 12 },
  chartContainer: { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1 },
  chartArea: { flexDirection: "row", alignItems: "flex-end", height: 160, gap: 4 },
  barWrapper: { flex: 1, alignItems: "center", gap: 4 },
  barContainer: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9, textAlign: "center" },
  insightCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, padding: 16 },
  insightText: { flex: 1, fontSize: 15, lineHeight: 22 },
});
