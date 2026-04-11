import React, { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";
import type { ScoreResult } from "@/utils/scoring";

export default function ChallengeEndScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { result: resultParam, difficulty } = useLocalSearchParams<{ result: string; difficulty: string }>();
  const { dog, setLastTrainedDate, setStreak, streak } = useApp();
  const { user } = useAuth();
  const scoreAnim = useRef(new Animated.Value(0)).current;

  const result: ScoreResult | null = resultParam ? JSON.parse(resultParam) : null;
  const score = result?.participationPoints ?? 0;
  const isExpert = difficulty === "expert";

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  useEffect(() => {
    Animated.spring(scoreAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();

    if (result && dog?.id && user?.id) {
      saveSession();
    }

    const today = new Date().toDateString();
    const lastDate = new Date().toDateString();
    if (today !== lastDate) {
      setStreak(streak + 1);
    }
    setLastTrainedDate(new Date().toISOString());
  }, []);

  const saveSession = async () => {
    if (!result || !dog?.id || !user?.id) return;
    try {
      const { getItemAsync } = await import("expo-secure-store");
      const token = await getItemAsync("auth_session_token");
      await fetch(`${apiBase}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dogId: dog.id,
          mode: "quickbites",
          difficulty,
          rawScore: result.rawScore,
          participationPoints: result.participationPoints,
          bonuses: result.bonuses,
          commandsUsed: result.commandResults.map((r) => ({ name: r.name, success: r.success, skipped: r.skipped })),
          durationSeconds: 120,
          completed: true,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const scoreStyle = {
    transform: [{ scale: scoreAnim }],
    opacity: scoreAnim,
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24), paddingBottom: 40 + (Platform.OS === "web" ? 34 : insets.bottom) }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>
        {dog?.name ? `${dog.name}'s Session!` : "Session Complete!"}
      </Text>

      <Animated.View style={[styles.scoreContainer, scoreStyle]}>
        <Text style={[styles.scoreValue, { color: score < 0 ? "#ef4444" : colors.peach, fontFamily: "FredokaOne_400Regular" }]}>{score}</Text>
        <Text style={[styles.scoreLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>Participation Points</Text>
      </Animated.View>

      {isExpert && score < 0 && (
        <View style={[styles.expertNote, { backgroundColor: "#fef2f2" }]}>
          <Text style={[styles.expertNoteText, { color: "#ef4444", fontFamily: "Nunito_700Bold" }]}>
            Tough session — Expert is meant to be hard. Come back stronger!
          </Text>
        </View>
      )}

      <View style={[styles.breakdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.breakdownTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Command Breakdown</Text>
        {result?.commandResults.map((r, i) => (
          <View key={i} style={[styles.commandRow, i < (result.commandResults.length - 1) && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.cmdName, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>{r.name}</Text>
            {r.skipped ? (
              <Feather name="x-circle" size={18} color="#ef4444" />
            ) : r.success ? (
              <Feather name="check-circle" size={18} color={colors.mint} />
            ) : (
              <Feather name="clock" size={18} color={colors.lemon} />
            )}
            <Text style={[styles.cmdPoints, { color: r.pointsEarned > 0 ? colors.mint : "#ef4444", fontFamily: "Nunito_900Black" }]}>
              {r.pointsEarned > 0 ? "+" : ""}{r.pointsEarned}
            </Text>
          </View>
        ))}
      </View>

      {(result?.bonuses ?? []).length > 0 && (
        <View style={styles.bonusSection}>
          <Text style={[styles.bonusTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Bonuses</Text>
          <View style={styles.bonusChips}>
            {result!.bonuses.map((b) => (
              <View key={b.name} style={[styles.bonusChip, { backgroundColor: colors.lavLight }]}>
                <Text style={[styles.bonusChipText, { color: colors.lavender, fontFamily: "Nunito_700Bold" }]}>{b.label} +{b.points}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {streak > 0 && (
        <View style={[styles.streakBox, { backgroundColor: colors.peachLight }]}>
          <Feather name="zap" size={20} color={colors.peach} />
          <Text style={[styles.streakText, { color: colors.peach, fontFamily: "Nunito_900Black" }]}>{streak} day streak!</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.playAgainBtn, { backgroundColor: colors.peach }]} onPress={() => router.replace("/challenge-setup")} activeOpacity={0.85}>
        <Text style={[styles.playAgainText, { fontFamily: "Nunito_900Black" }]}>Play Again</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.homeBtn, { borderColor: colors.border }]} onPress={() => router.replace("/(tabs)")} activeOpacity={0.8}>
        <Text style={[styles.homeText, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Go Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, alignItems: "center" },
  title: { fontSize: 30, textAlign: "center", marginBottom: 8 },
  scoreContainer: { alignItems: "center", marginBottom: 24 },
  scoreValue: { fontSize: 80, lineHeight: 88 },
  scoreLabel: { fontSize: 14 },
  expertNote: { borderRadius: 12, padding: 16, marginBottom: 20, width: "100%" },
  expertNoteText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  breakdown: { borderRadius: 20, padding: 18, width: "100%", marginBottom: 20, borderWidth: 1 },
  breakdownTitle: { fontSize: 16, marginBottom: 14 },
  commandRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  cmdName: { flex: 1, fontSize: 15 },
  cmdPoints: { fontSize: 15, minWidth: 40, textAlign: "right" },
  bonusSection: { width: "100%", marginBottom: 20 },
  bonusTitle: { fontSize: 15, marginBottom: 10 },
  bonusChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bonusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  bonusChipText: { fontSize: 13 },
  streakBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, marginBottom: 24 },
  streakText: { fontSize: 16 },
  playAgainBtn: { width: "100%", paddingVertical: 18, borderRadius: 16, alignItems: "center", marginBottom: 12, shadowColor: "#FF8B6A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  playAgainText: { color: "#fff", fontSize: 18 },
  homeBtn: { width: "100%", paddingVertical: 16, borderRadius: 16, alignItems: "center", borderWidth: 1.5 },
  homeText: { fontSize: 17 },
});
