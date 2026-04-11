import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, interpolateColor, runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { DIFFICULTY_WINDOW, calculateScore } from "@/utils/scoring";
import type { Difficulty, RawCommandInput } from "@/utils/scoring";

export default function ChallengeActiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sequence: seqParam, difficulty: diffParam } = useLocalSearchParams<{ sequence: string; difficulty: string }>();
  const sequence: string[] = seqParam ? JSON.parse(seqParam) : [];
  const difficulty = (diffParam || "easy") as Difficulty;
  const window = DIFFICULTY_WINDOW[difficulty];

  const [commandIndex, setCommandIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const inputs = useRef<RawCommandInput[]>([]);
  const startTime = useRef<number>(Date.now());
  const elapsedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayTime, setDisplayTime] = useState(window);
  const [windowExceeded, setWindowExceeded] = useState(false);

  const timerProgress = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    width: `${timerProgress.value * 100}%` as any,
    backgroundColor: interpolateColor(
      timerProgress.value,
      [0, 0.3, 1],
      ["#ef4444", "#f59e0b", colors.mint]
    ),
  }));

  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current!);
    elapsedRef.current = 0;
    setDisplayTime(window);
    setWindowExceeded(false);
    timerProgress.value = 1;
    timerProgress.value = withTiming(0, { duration: window * 1000, easing: Easing.linear });
    startTime.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      elapsedRef.current = elapsed;
      const remaining = window - elapsed;
      runOnJS(setDisplayTime)(parseFloat(Math.max(0, remaining).toFixed(1)));
      runOnJS(setWindowExceeded)(remaining <= 0);
    }, 100);
  }, [window, timerProgress]);

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startTimer();
    return () => clearInterval(intervalRef.current!);
  }, [commandIndex]);

  const advanceOrEnd = (newInputs: RawCommandInput[]) => {
    clearInterval(intervalRef.current!);
    const result = calculateScore(newInputs, difficulty);
    const pts = result.participationPoints;
    setScore(pts);
    inputs.current = newInputs;

    if (commandIndex + 1 >= sequence.length) {
      const finalResult = calculateScore(newInputs, difficulty);
      router.replace({
        pathname: "/challenge-end",
        params: {
          result: JSON.stringify(finalResult),
          difficulty,
          dogName: "",
        },
      });
    } else {
      setCommandIndex((i) => i + 1);
    }
  };

  const handleHoldStart = () => {
    setIsHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleHoldEnd = () => {
    if (!isHolding) return;
    setIsHolding(false);
    clearInterval(intervalRef.current!);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const elapsed = elapsedRef.current;
    const newInput: RawCommandInput = {
      name: sequence[commandIndex],
      skipped: false,
      timeSeconds: elapsed,
      windowSeconds: window,
    };
    advanceOrEnd([...inputs.current, newInput]);
  };

  const handleSkip = () => {
    clearInterval(intervalRef.current!);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const elapsed = elapsedRef.current;
    const newInput: RawCommandInput = {
      name: sequence[commandIndex],
      skipped: true,
      timeSeconds: elapsed,
      windowSeconds: window,
    };
    advanceOrEnd([...inputs.current, newInput]);
  };

  const currentCommand = sequence[commandIndex] ?? "";

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.topBar}>
        <Text style={[styles.counter, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          {commandIndex + 1} of {sequence.length}
        </Text>
        <View style={[styles.scorePill, { backgroundColor: colors.lemon }]}>
          <Text style={[styles.scoreText, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>{score} pts</Text>
        </View>
      </View>

      <View style={styles.pipsRow}>
        {sequence.map((_, i) => (
          <View key={i} style={[styles.pip, { backgroundColor: i < commandIndex ? colors.peach : i === commandIndex ? colors.peachMid : colors.muted }]} />
        ))}
      </View>

      <Text style={[styles.diffLabel, { color: colors.lavender, fontFamily: "Nunito_700Bold" }]}>{difficulty.toUpperCase()}</Text>
      <Text style={[styles.commandWord, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{currentCommand}</Text>

      <View style={styles.timerContainer}>
        <Animated.View style={[styles.timerBar, animStyle]} />
      </View>
      <Text style={[styles.timerText, { color: windowExceeded ? "#ef4444" : colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
        {windowExceeded
          ? `${(elapsedRef.current - window).toFixed(1)}s over`
          : `${displayTime.toFixed(1)}s remaining`}
      </Text>

      <TouchableOpacity
        style={[styles.holdButton, { borderColor: colors.peachMid, backgroundColor: isHolding ? colors.peachMid : colors.peach }]}
        onPressIn={handleHoldStart}
        onPressOut={handleHoldEnd}
        activeOpacity={1}
      >
        <Text style={[styles.holdText, { fontFamily: "Nunito_900Black" }]}>HOLD</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
        <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>skip command</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: 16, marginBottom: 12 },
  counter: { fontSize: 16 },
  scorePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  scoreText: { fontSize: 15 },
  pipsRow: { flexDirection: "row", gap: 8, width: "100%", marginBottom: 48 },
  pip: { height: 8, flex: 1, borderRadius: 4 },
  diffLabel: { fontSize: 13, letterSpacing: 2, marginBottom: 12 },
  commandWord: { fontSize: 52, textAlign: "center", marginBottom: 32 },
  timerContainer: { width: "100%", height: 10, backgroundColor: "#EDE6DE", borderRadius: 5, overflow: "hidden", marginBottom: 8 },
  timerBar: { height: "100%", borderRadius: 5 },
  timerText: { fontSize: 14, marginBottom: 64 },
  holdButton: { width: 180, height: 180, borderRadius: 90, borderWidth: 3, alignItems: "center", justifyContent: "center", shadowColor: "#FF8B6A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginBottom: 24 },
  holdText: { color: "#FFFFFF", fontSize: 24, letterSpacing: 3 },
  skipText: { fontSize: 14, textDecorationLine: "underline" },
});
