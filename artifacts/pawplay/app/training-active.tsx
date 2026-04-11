import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

export default function TrainingActiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { command, rewardType, variableSchedule: vsParam, reps: repsParam } = useLocalSearchParams<{
    command: string; rewardType: string; variableSchedule: string; reps: string;
  }>();
  const { dog } = useApp();
  const { user } = useAuth();
  const reps = parseInt(repsParam ?? "5");
  const variableSchedule = vsParam === "1";

  const [currentRep, setCurrentRep] = useState(1);
  const [phase, setPhase] = useState<"ready" | "waiting" | "complete">("ready");
  const [successCount, setSuccessCount] = useState(0);
  const [interTrialCountdown, setInterTrialCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  const handleMarkDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const newSuccessCount = successCount + 1;
    setSuccessCount(newSuccessCount);

    if (currentRep >= reps) {
      setPhase("complete");
      saveSession(newSuccessCount);
      return;
    }

    const waitTime = Math.floor(Math.random() * 6) + 7;
    setInterTrialCountdown(waitTime);
    setPhase("waiting");

    let remaining = waitTime;
    intervalRef.current = setInterval(() => {
      remaining--;
      setInterTrialCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        setCurrentRep((r) => r + 1);
        setInterTrialCountdown(null);
        setPhase("ready");
      }
    }, 1000);
  }, [currentRep, reps, successCount]);

  const handleReset = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const saveSession = async (successes: number) => {
    if (!dog?.id || !user?.id) return;
    try {
      const { getItemAsync } = await import("expo-secure-store");
      const token = await getItemAsync("auth_session_token");
      await fetch(`${apiBase}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dogId: dog.id,
          mode: "training",
          rawScore: successes * 20,
          participationPoints: successes * 20,
          bonuses: [],
          commandsUsed: [{ name: command, success: successes > 0 }],
          durationSeconds: reps * 30,
          completed: true,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (phase === "complete") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <View style={[styles.doneCircle, { backgroundColor: colors.mintLight }]}>
          <Feather name="check" size={48} color={colors.mint} />
        </View>
        <Text style={[styles.doneTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Session Done!</Text>
        <Text style={[styles.doneStats, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          {successCount} of {reps} reps successful
        </Text>
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: colors.peach }]}
          onPress={() => router.replace("/(tabs)")}
          activeOpacity={0.85}
        >
          <Text style={[styles.doneBtnText, { fontFamily: "Nunito_900Black" }]}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
        <Feather name="x" size={22} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Text style={[styles.repProgress, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Rep {currentRep} of {reps}</Text>

      <View style={styles.pipsRow}>
        {Array.from({ length: reps }).map((_, i) => (
          <View key={i} style={[styles.pip, { backgroundColor: i < currentRep - 1 ? colors.mint : i === currentRep - 1 ? colors.mintMid : colors.muted }]} />
        ))}
      </View>

      <Text style={[styles.commandWord, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{command}</Text>

      {phase === "waiting" && interTrialCountdown !== null && (
        <View style={[styles.waitBox, { backgroundColor: colors.mintLight }]}>
          {variableSchedule && successCount % 5 !== 0 ? (
            <Text style={[styles.waitText, { color: colors.mint, fontFamily: "Nunito_900Black" }]}>Keep going — reward coming!</Text>
          ) : (
            <Text style={[styles.waitText, { color: colors.mint, fontFamily: "Nunito_900Black" }]}>Good! Wait {interTrialCountdown}s...</Text>
          )}
        </View>
      )}

      {phase === "ready" && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.markDoneBtn, { backgroundColor: colors.mint }]}
            onPress={handleMarkDone}
            activeOpacity={0.85}
          >
            <Feather name="check" size={24} color="#fff" />
            <Text style={[styles.markDoneText, { fontFamily: "Nunito_900Black" }]}>Mark Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resetBtn, { borderColor: colors.border }]}
            onPress={handleReset}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
            <Text style={[styles.resetText, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  backBtn: { alignSelf: "flex-start", marginBottom: 16 },
  repProgress: { fontSize: 16, marginBottom: 16 },
  pipsRow: { flexDirection: "row", gap: 6, width: "100%", marginBottom: 48 },
  pip: { height: 6, flex: 1, borderRadius: 3 },
  commandWord: { fontSize: 56, textAlign: "center", marginBottom: 32 },
  waitBox: { borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, marginBottom: 32 },
  waitText: { fontSize: 18, textAlign: "center" },
  actions: { gap: 14, width: "100%" },
  markDoneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20, borderRadius: 20, shadowColor: "#3DB884", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  markDoneText: { color: "#fff", fontSize: 20 },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5 },
  resetText: { fontSize: 16 },
  doneCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  doneTitle: { fontSize: 36, marginBottom: 8 },
  doneStats: { fontSize: 18, marginBottom: 40 },
  doneBtn: { paddingVertical: 18, paddingHorizontal: 48, borderRadius: 16 },
  doneBtnText: { color: "#fff", fontSize: 18 },
});
