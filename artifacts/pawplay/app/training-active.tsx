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
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from "react-native-reanimated";

type TrainingPhase = "ready" | "countdown" | "reward" | "waiting" | "complete";

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

  const markerCue = (dog as any)?.markerCue ?? "Yes";
  const releaseCue = (dog as any)?.releaseCue ?? "Free";

  const [currentRep, setCurrentRep] = useState(1);
  const [phase, setPhase] = useState<TrainingPhase>("ready");
  const [completedReps, setCompletedReps] = useState(0);
  const [interTrialCountdown, setInterTrialCountdown] = useState<number | null>(null);
  const [rewardResult, setRewardResult] = useState<"reward" | "hold" | null>(null);
  const [decisionCountdown, setDecisionCountdown] = useState<number | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeX = useSharedValue(0);

  const commandShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleReleaseCue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const newCompleted = completedReps + 1;
    setCompletedReps(newCompleted);

    if (variableSchedule) {
      const countdownDuration = Math.floor(Math.random() * 2) + 1;
      setDecisionCountdown(countdownDuration);
      setPhase("countdown");

      let remaining = countdownDuration;
      intervalRef.current = setInterval(() => {
        remaining--;
        setDecisionCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(intervalRef.current!);
          const reward = Math.random() < 0.49;
          setRewardResult(reward ? "reward" : "hold");
          setPhase("reward");

          if (reward) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          if (currentRep >= reps) {
            timerRef.current = setTimeout(() => {
              setPhase("complete");
              saveSession(newCompleted);
            }, 2000);
            return;
          }

          startInterTrialWait(newCompleted);
        }
      }, 1000);
    } else {
      setRewardResult("reward");
      setPhase("reward");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (currentRep >= reps) {
        timerRef.current = setTimeout(() => {
          setPhase("complete");
          saveSession(newCompleted);
        }, 2000);
        return;
      }

      startInterTrialWait(newCompleted);
    }
  }, [currentRep, reps, completedReps, variableSchedule]);

  const startInterTrialWait = (_completedCount: number) => {
    const waitTime = Math.floor(Math.random() * 6) + 7;

    timerRef.current = setTimeout(() => {
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
          setRewardResult(null);
          setDecisionCountdown(null);
          setResetCount(0);
          setPhase("ready");
        }
      }, 1000);
    }, 2000);
  };

  const handleReset = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setResetCount((c) => c + 1);
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const saveSession = async (completed: number) => {
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
          rawScore: 0,
          participationPoints: 0,
          bonuses: [],
          commandsUsed: [{ name: command, success: completed > 0 }],
          durationSeconds: reps * 30,
          completed: true,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const encouragements = [
    "Great work today!",
    "Your dog is getting stronger!",
    "Consistency is key - keep it up!",
    "Amazing effort from both of you!",
    "Practice makes perfect!",
  ];

  if (phase === "complete") {
    const msg = encouragements[Math.floor(Math.random() * encouragements.length)];
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <View style={[styles.doneCircle, { backgroundColor: colors.mintLight }]}>
          <Feather name="check" size={48} color={colors.mint} />
        </View>
        <Text style={[styles.doneTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Session Complete!</Text>
        <Text style={[styles.doneCommand, { color: colors.peach, fontFamily: "Nunito_900Black" }]}>{command}</Text>
        <Text style={[styles.doneStats, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          {completedReps} of {reps} reps completed
        </Text>
        <View style={[styles.encourageBox, { backgroundColor: colors.mintLight }]}>
          <Text style={[styles.encourageText, { color: colors.mint, fontFamily: "Nunito_700Bold" }]}>{msg}</Text>
        </View>
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: colors.peach }]}
          onPress={() => router.replace({ pathname: "/training-active", params: { command, rewardType, variableSchedule: vsParam ?? "0", reps: String(reps) } })}
          activeOpacity={0.85}
        >
          <Text style={[styles.doneBtnText, { fontFamily: "Nunito_900Black" }]}>Train Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.doneBtnOutline, { borderColor: colors.border }]}
          onPress={() => router.replace("/(tabs)")}
          activeOpacity={0.85}
        >
          <Text style={[styles.doneBtnOutlineText, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <TouchableOpacity onPress={() => { clearTimers(); router.back(); }} style={styles.backBtn} activeOpacity={0.7}>
        <Feather name="x" size={22} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Text style={[styles.repProgress, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Rep {currentRep} of {reps}</Text>

      <View style={styles.pipsRow}>
        {Array.from({ length: reps }).map((_, i) => (
          <View key={i} style={[styles.pip, { backgroundColor: i < currentRep - 1 ? colors.mint : i === currentRep - 1 ? colors.mintMid : colors.muted }]} />
        ))}
      </View>

      <Animated.View style={commandShakeStyle}>
        <Text style={[styles.commandWord, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{command}</Text>
      </Animated.View>

      {phase === "countdown" && decisionCountdown !== null && (
        <View style={[styles.waitBox, { backgroundColor: colors.lemonLight }]}>
          <Text style={[styles.waitText, { color: colors.lemon, fontFamily: "Nunito_900Black" }]}>Deciding... {decisionCountdown}s</Text>
        </View>
      )}

      {phase === "reward" && rewardResult === "reward" && (
        <View style={[styles.waitBox, { backgroundColor: colors.mintLight }]}>
          <Text style={[styles.rewardEmoji]}>🎉</Text>
          <Text style={[styles.waitText, { color: colors.mint, fontFamily: "Nunito_900Black" }]}>
            {markerCue}! Good reward — good boy!
          </Text>
        </View>
      )}

      {phase === "reward" && rewardResult === "hold" && (
        <View style={[styles.waitBox, { backgroundColor: "#fef2f2" }]}>
          <Text style={[styles.rewardEmoji]}>✋</Text>
          <Text style={[styles.waitText, { color: "#ef4444", fontFamily: "Nunito_900Black" }]}>
            Hold reward — not this time
          </Text>
        </View>
      )}

      {phase === "waiting" && interTrialCountdown !== null && (
        <View style={[styles.waitBox, { backgroundColor: colors.mintLight }]}>
          <Text style={[styles.waitText, { color: colors.mint, fontFamily: "Nunito_900Black" }]}>Next rep in {interTrialCountdown}s...</Text>
        </View>
      )}

      {phase === "ready" && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.markDoneBtn, { backgroundColor: colors.mint }]}
            onPress={handleReleaseCue}
            activeOpacity={0.85}
          >
            <Text style={[styles.markDoneText, { fontFamily: "Nunito_900Black" }]}>Release cue command</Text>
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
  waitBox: { borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, marginBottom: 32, alignItems: "center", gap: 8 },
  waitText: { fontSize: 18, textAlign: "center" },
  rewardEmoji: { fontSize: 36 },
  actions: { gap: 14, width: "100%" },
  markDoneBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20, borderRadius: 20, shadowColor: "#3DB884", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  markDoneText: { color: "#fff", fontSize: 20 },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5 },
  resetText: { fontSize: 16 },
  doneCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  doneTitle: { fontSize: 36, marginBottom: 8 },
  doneCommand: { fontSize: 22, marginBottom: 8 },
  doneStats: { fontSize: 18, marginBottom: 16 },
  encourageBox: { borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, marginBottom: 32, width: "100%" },
  encourageText: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  doneBtn: { paddingVertical: 18, paddingHorizontal: 48, borderRadius: 16, width: "100%", alignItems: "center", marginBottom: 12 },
  doneBtnText: { color: "#fff", fontSize: 18 },
  doneBtnOutline: { paddingVertical: 16, paddingHorizontal: 48, borderRadius: 16, width: "100%", alignItems: "center", borderWidth: 1.5 },
  doneBtnOutlineText: { fontSize: 17 },
});
