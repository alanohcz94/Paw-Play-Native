import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";
import { useSound } from "@/hooks/useSound";

const MINT = "#3DB884";
const PEACH = "#FF8B6A";
const LAVENDER = "#8B68FF";
const SKY = "#68B4FF";

const COPY_VARIANTS = [
  (name: string) => `${name} was locked in today! 🔥`,
  (name: string) => `Sharp session — ${name} never saw the hold coming ⚡`,
  () => "Every rep counts — great Blitz! 💪",
  (name: string) => `${name} held like a champ today 🏅`,
];

function calculateBlitzScore({
  repsCompleted,
  holdsCompleted,
  isPersonalBest,
  timerCompleted,
}: {
  repsCompleted: number;
  holdsCompleted: number;
  isPersonalBest: boolean;
  timerCompleted: boolean;
}) {
  let score = 0;
  score += repsCompleted * 5;
  score += holdsCompleted * 10;
  if (timerCompleted) score += 15;
  if (isPersonalBest) score += 20;
  return score;
}

export default function BlitzEndScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { repsCompleted: repsParam, holdsCompleted: holdsParam, duration: durParam, commandsUsed: cmdsParam } =
    useLocalSearchParams<{
      repsCompleted: string;
      holdsCompleted: string;
      duration: string;
      commandsUsed: string;
    }>();

  const repsCompleted = parseInt(repsParam ?? "0", 10);
  const holdsCompleted = parseInt(holdsParam ?? "0", 10);
  const duration = parseInt(durParam ?? "90", 10);
  const commandsUsed: string[] = cmdsParam ? JSON.parse(cmdsParam) : [];

  const { dog, updateUserStreak, streak, setCommands } = useApp();
  const { user } = useAuth();
  const { play } = useSound();

  const [isPersonalBest, setIsPersonalBest] = useState(false);
  const [totalScore, setTotalScore] = useState(
    calculateBlitzScore({ repsCompleted, holdsCompleted, isPersonalBest: false, timerCompleted: true })
  );
  const [copy] = useState(() => {
    const variant = COPY_VARIANTS[Math.floor(Math.random() * COPY_VARIANTS.length)];
    return variant(dog?.name ?? "your dog");
  });

  const scoreAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scoreAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
    Animated.spring(statsAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 40,
      friction: 10,
      delay: 300,
    }).start();

    play("success");
    updateUserStreak();

    if (dog?.id && user?.id) {
      runSaveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSaveSession = async () => {
    if (!dog?.id || !user?.id) return;
    try {
      const { authedFetch } = await import("@/lib/authedFetch");

      // Check personal best (max reps in prior blitz sessions)
      const prevRes = await authedFetch(`/api/sessions?dogId=${dog.id}`);
      let pb = false;
      if (prevRes.ok) {
        const { sessions } = await prevRes.json();
        const blitzSessions = (sessions as { mode: string; commandsUsed: unknown[] }[]).filter(
          (s) => s.mode === "blitz" && Array.isArray(s.commandsUsed)
        );
        // commandsUsed array length is used as proxy for reps in saved sessions
        // If we stored repsCompleted as a bonus label we can check it; otherwise use commandsUsed length
        const prevMax = blitzSessions.reduce((max: number, s) => {
          // Try to extract repsCompleted from bonuses if stored, else 0
          const stored = (s as { repsCompleted?: number }).repsCompleted ?? 0;
          return Math.max(max, stored);
        }, 0);
        pb = repsCompleted > prevMax && repsCompleted > 0;
        setIsPersonalBest(pb);
        const final = calculateBlitzScore({
          repsCompleted,
          holdsCompleted,
          isPersonalBest: pb,
          timerCompleted: true,
        });
        setTotalScore(final);
      }

      const bonuses: { name: string; label: string; points: number }[] = [
        { name: "session_complete", label: "Session Complete", points: 15 },
      ];
      if (pb) bonuses.push({ name: "personal_best", label: "Personal Best", points: 20 });

      const finalScore = calculateBlitzScore({
        repsCompleted,
        holdsCompleted,
        isPersonalBest: pb,
        timerCompleted: true,
      });

      await authedFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dogId: dog.id,
          mode: "blitz",
          difficulty: null,
          durationSeconds: duration,
          rawScore: finalScore,
          participationPoints: finalScore,
          repsCompleted,
          bonuses,
          commandsUsed: commandsUsed.map((name) => ({
            name,
            success: true,
            count: 1,
          })),
          completed: true,
        }),
      });

      const cmdsRes = await authedFetch(`/api/dogs/${dog.id}/commands`);
      if (cmdsRes.ok) {
        const { commands } = await cmdsRes.json();
        setCommands(commands);
      }
    } catch (e) {
      console.error("Blitz session save error:", e);
    }
  };

  const scoreStyle = {
    transform: [{ scale: scoreAnim }],
    opacity: scoreAnim,
  };
  const statsStyle = {
    transform: [{ scale: statsAnim }],
    opacity: statsAnim,
  };

  const breakdown = [
    { label: "Base reps", value: `${repsCompleted} × 5`, pts: repsCompleted * 5 },
    { label: "Hold bonus", value: `${holdsCompleted} × 10`, pts: holdsCompleted * 10 },
    { label: "Session complete", value: "+15", pts: 15 },
    ...(isPersonalBest ? [{ label: "Personal best", value: "+20", pts: 20 }] : []),
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
          paddingBottom: 40 + (Platform.OS === "web" ? 34 : insets.bottom),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={[styles.title, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}
      >
        {dog?.name ? `${dog.name}'s Blitz!` : "Blitz Complete!"}
      </Text>

      {/* Main score */}
      <Animated.View style={[styles.scoreWrap, scoreStyle]}>
        <Text style={[styles.scoreValue, { color: MINT, fontFamily: "FredokaOne_400Regular" }]}>
          {totalScore}
        </Text>
        <Text
          style={[styles.scoreLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}
        >
          Blitz Points
        </Text>
      </Animated.View>

      {/* Personal best banner */}
      {isPersonalBest && (
        <View style={[styles.pbBanner, { backgroundColor: MINT }]}>
          <Text style={[styles.pbText, { fontFamily: "Nunito_900Black" }]}>
            New personal best! {repsCompleted} reps 🎉
          </Text>
        </View>
      )}

      {/* Stats row */}
      <Animated.View style={[styles.statsRow, statsStyle]}>
        {[
          { label: "Reps", value: repsCompleted, color: PEACH },
          { label: "Holds", value: holdsCompleted, color: LAVENDER },
          { label: "Sec", value: duration, color: SKY },
        ].map(({ label, value, color }) => (
          <View key={label} style={[styles.statCard, { backgroundColor: color + "22" }]}>
            <Text style={[styles.statValue, { color, fontFamily: "FredokaOne_400Regular" }]}>
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
        ))}
      </Animated.View>

      {/* Points breakdown */}
      <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text
          style={[
            styles.breakdownTitle,
            { color: colors.dark, fontFamily: "Nunito_900Black" },
          ]}
        >
          Points Breakdown
        </Text>
        {breakdown.map((row) => (
          <View key={row.label} style={styles.breakdownRow}>
            <Text
              style={[
                styles.breakdownLabel,
                { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
              ]}
            >
              {row.label}
            </Text>
            <Text
              style={[styles.breakdownPts, { color: colors.dark, fontFamily: "Nunito_900Black" }]}
            >
              +{row.pts}
            </Text>
          </View>
        ))}
      </View>

      {/* Commands practiced */}
      {commandsUsed.length > 0 && (
        <View style={styles.cmdsSection}>
          <Text
            style={[
              styles.cmdsTitle,
              { color: colors.dark, fontFamily: "Nunito_900Black" },
            ]}
          >
            Commands Practiced
          </Text>
          <View style={styles.chips}>
            {commandsUsed.map((name) => (
              <View
                key={name}
                style={[styles.chip, { backgroundColor: colors.mintLight }]}
              >
                <Text
                  style={[styles.chipText, { color: MINT, fontFamily: "Nunito_700Bold" }]}
                >
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Streak */}
      {streak > 0 && (
        <View style={[styles.streakBox, { backgroundColor: colors.peachLight }]}>
          <Feather name="zap" size={18} color={PEACH} />
          <Text style={[styles.streakText, { color: PEACH, fontFamily: "Nunito_900Black" }]}>
            {streak} day streak!
          </Text>
        </View>
      )}

      {/* Copy */}
      <Text
        style={[
          styles.copy,
          { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
        ]}
      >
        {copy}
      </Text>

      {/* Buttons */}
      <TouchableOpacity
        style={[styles.goAgainBtn, { backgroundColor: MINT }]}
        onPress={() =>
          router.replace({
            pathname: "/blitz-active",
            params: { duration: String(duration) },
          })
        }
        activeOpacity={0.85}
      >
        <Text style={[styles.goAgainText, { fontFamily: "Nunito_900Black" }]}>Go Again</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.homeBtn, { borderColor: colors.border }]}
        onPress={() => router.replace("/(tabs)")}
        activeOpacity={0.8}
      >
        <Text style={[styles.homeText, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
          Home
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, alignItems: "center" },
  title: { fontSize: 28, textAlign: "center", marginBottom: 8 },
  scoreWrap: { alignItems: "center", marginBottom: 16 },
  scoreValue: { fontSize: 72, lineHeight: 80 },
  scoreLabel: { fontSize: 13 },
  pbBanner: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  pbText: { color: "#fff", fontSize: 15 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 4,
  },
  statValue: { fontSize: 28 },
  statLabel: { fontSize: 12 },
  breakdownCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  breakdownTitle: { fontSize: 14, marginBottom: 4 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 14 },
  breakdownPts: { fontSize: 14 },
  cmdsSection: { width: "100%", marginBottom: 20 },
  cmdsTitle: { fontSize: 14, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 13 },
  streakBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
  },
  streakText: { fontSize: 15 },
  copy: { fontSize: 14, textAlign: "center", marginBottom: 28, lineHeight: 20 },
  goAgainBtn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  goAgainText: { color: "#fff", fontSize: 18 },
  homeBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
  },
  homeText: { fontSize: 17 },
});
