import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing, interpolateColor, runOnJS,
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
  const windowSec = DIFFICULTY_WINDOW[difficulty];
  const isExpert = difficulty === "expert";

  const [commandIndex, setCommandIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [holdPhase, setHoldPhase] = useState<"waiting" | "holding" | "idle">("idle");
  const [holdCountdown, setHoldCountdown] = useState(0);
  const [resetCount, setResetCount] = useState(0);
  const [maxPoints, setMaxPoints] = useState(20);
  const [pointsFlash, setPointsFlash] = useState<number | null>(null);
  const [bonusBubble, setBonusBubble] = useState<string | null>(null);
  const inputs = useRef<RawCommandInput[]>([]);
  const startTime = useRef<number>(Date.now());
  const elapsedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturedElapsed = useRef(0);
  const [displayTime, setDisplayTime] = useState(windowSec);
  const [windowExceeded, setWindowExceeded] = useState(false);

  const timerProgress = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, timerProgress.value * 100)}%` as any,
    backgroundColor: interpolateColor(
      Math.max(0, timerProgress.value),
      [0, 0.3, 1],
      ["#ef4444", "#f59e0b", colors.mint]
    ),
  }));

  const commandShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current!);
    elapsedRef.current = 0;
    setDisplayTime(windowSec);
    setWindowExceeded(false);
    setHoldPhase("idle");
    timerProgress.value = 1;
    timerProgress.value = withTiming(0, { duration: windowSec * 1000, easing: Easing.linear });
    startTime.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      elapsedRef.current = elapsed;
      const remaining = windowSec - elapsed;
      runOnJS(setDisplayTime)(parseFloat(remaining.toFixed(1)));
      if (remaining <= 0) {
        runOnJS(setWindowExceeded)(true);
      }
    }, 100);
  }, [windowSec, timerProgress]);

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResetCount(0);
    setMaxPoints(20);
    setPointsFlash(null);
    setBonusBubble(null);
    startTimer();
    return () => {
      clearInterval(intervalRef.current!);
      clearInterval(holdTimerRef.current!);
    };
  }, [commandIndex]);

  const showPointsFlash = (pts: number) => {
    setPointsFlash(pts);
    flashOpacity.value = 1;
    flashOpacity.value = withTiming(0, { duration: 1200 });
    setTimeout(() => setPointsFlash(null), 1200);
  };

  const checkBonusBubble = (allInputs: RawCommandInput[]) => {
    const lastInput = allInputs[allInputs.length - 1];
    if (!lastInput) return;

    if (!lastInput.skipped && lastInput.timeSeconds <= lastInput.windowSeconds / 2) {
      setBonusBubble("+5 Speed");
      setTimeout(() => setBonusBubble(null), 1500);
      return;
    }

    let streak = 0;
    for (let i = allInputs.length - 1; i >= 0; i--) {
      if (!allInputs[i].skipped && allInputs[i].timeSeconds <= allInputs[i].windowSeconds) {
        streak++;
      } else break;
    }
    if (streak >= 3) {
      setBonusBubble("Combo x" + streak + "!");
      setTimeout(() => setBonusBubble(null), 1500);
    }
  };

  const advanceOrEnd = (newInputs: RawCommandInput[], pts: number) => {
    clearInterval(intervalRef.current!);
    clearInterval(holdTimerRef.current!);
    const result = calculateScore(newInputs, difficulty);
    const displayPts = isExpert ? result.participationPoints : Math.max(0, result.participationPoints);
    setScore(displayPts);
    inputs.current = newInputs;
    showPointsFlash(pts);
    checkBonusBubble(newInputs);

    if (commandIndex + 1 >= sequence.length) {
      setTimeout(() => {
        const finalResult = calculateScore(newInputs, difficulty);
        router.replace({
          pathname: "/challenge-end",
          params: {
            result: JSON.stringify(finalResult),
            difficulty,
            dogName: "",
          },
        });
      }, 800);
    } else {
      setTimeout(() => setCommandIndex((i) => i + 1), 800);
    }
  };

  const handleHoldStart = () => {
    if (holdPhase === "holding") return;
    setHoldPhase("holding");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    clearInterval(intervalRef.current!);
    capturedElapsed.current = elapsedRef.current;

    const holdDuration = Math.floor(Math.random() * 3) + 1;
    setHoldCountdown(holdDuration);

    let remaining = holdDuration;
    holdTimerRef.current = setInterval(() => {
      remaining--;
      runOnJS(setHoldCountdown)(remaining);
      if (remaining <= 0) {
        clearInterval(holdTimerRef.current!);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        const elapsed = capturedElapsed.current;
        const secondsOver = Math.max(0, elapsed - windowSec);
        let pts = elapsed <= windowSec ? maxPoints : maxPoints - Math.floor(secondsOver);
        if (!isExpert) {
          pts = Math.max(0, pts);
        }

        const newInput: RawCommandInput = {
          name: sequence[commandIndex],
          skipped: false,
          timeSeconds: elapsed,
          windowSeconds: windowSec,
          resetCount,
          maxPoints,
        };
        runOnJS(advanceOrEnd)([...inputs.current, newInput], pts);
      }
    }, 1000);
  };

  const handleHoldRelease = () => {
    if (holdPhase !== "holding") return;
    if (holdCountdown > 0) {
      clearInterval(holdTimerRef.current!);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      handleReset();
    }
  };

  const handleReset = () => {
    clearInterval(holdTimerRef.current!);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const deduction = Math.floor(maxPoints * 0.25);
    const newMax = Math.max(1, maxPoints - deduction);
    setMaxPoints(newMax);
    setResetCount((c) => c + 1);
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
    startTimer();
  };

  const handleSkip = () => {
    clearInterval(intervalRef.current!);
    clearInterval(holdTimerRef.current!);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const elapsed = elapsedRef.current;
    const newInput: RawCommandInput = {
      name: sequence[commandIndex],
      skipped: true,
      timeSeconds: elapsed,
      windowSeconds: windowSec,
      resetCount,
    };
    const secondsOver = Math.max(0, elapsed - windowSec);
    let pts = 0;
    if (isExpert) {
      pts = -20 - Math.floor(secondsOver);
    }
    advanceOrEnd([...inputs.current, newInput], pts);
  };

  const currentCommand = sequence[commandIndex] ?? "";
  const scoreColor = isExpert && score < 0 ? "#ef4444" : colors.dark;
  const scorePrefix = isExpert && score < 0 ? "" : "";

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.topBar}>
        <Text style={[styles.counter, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          {commandIndex + 1} of {sequence.length}
        </Text>
        <View style={[styles.scorePill, { backgroundColor: isExpert && score < 0 ? "#fef2f2" : colors.lemon }]}>
          <Text style={[styles.scoreText, { color: scoreColor, fontFamily: "Nunito_900Black" }]}>{scorePrefix}{score} pts</Text>
        </View>
      </View>

      <View style={styles.pipsRow}>
        {sequence.map((_, i) => (
          <View key={i} style={[styles.pip, { backgroundColor: i < commandIndex ? colors.peach : i === commandIndex ? colors.peachMid : colors.muted }]} />
        ))}
      </View>

      <Text style={[styles.diffLabel, { color: colors.lavender, fontFamily: "Nunito_700Bold" }]}>{difficulty.toUpperCase()}</Text>

      <Animated.View style={commandShakeStyle}>
        <Text style={[styles.commandWord, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{currentCommand}</Text>
      </Animated.View>

      {resetCount > 0 && (
        <Text style={[styles.maxPtsLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          Max: {maxPoints} pts
        </Text>
      )}

      <View style={styles.timerContainer}>
        <Animated.View style={[styles.timerBar, animStyle]} />
      </View>
      <Text style={[styles.timerText, { color: windowExceeded ? "#ef4444" : colors.mutedForeground, fontFamily: windowExceeded ? "Nunito_900Black" : "Nunito_700Bold" }]}>
        {windowExceeded
          ? `-${Math.abs(displayTime).toFixed(1)}s over`
          : displayTime <= 0
            ? "0s"
            : `${displayTime.toFixed(1)}s remaining`}
      </Text>

      {bonusBubble && (
        <View style={[styles.bonusBubble, { backgroundColor: colors.lavLight }]}>
          <Text style={[styles.bonusBubbleText, { color: colors.lavender, fontFamily: "Nunito_900Black" }]}>{bonusBubble}</Text>
        </View>
      )}

      {pointsFlash !== null && (
        <Animated.View style={[styles.flashContainer, flashStyle]}>
          <Text style={[styles.flashText, { color: pointsFlash >= 0 ? colors.mint : "#ef4444", fontFamily: "FredokaOne_400Regular" }]}>
            {pointsFlash >= 0 ? "+" : ""}{pointsFlash}
          </Text>
        </Animated.View>
      )}

      <TouchableOpacity
        style={[
          styles.holdButton,
          {
            borderColor: holdPhase === "holding" ? colors.mint : colors.peachMid,
            backgroundColor: holdPhase === "holding" ? colors.mint : holdPhase === "idle" ? colors.peach : colors.peachMid,
            opacity: holdPhase === "idle" ? 0.7 : 1,
          },
        ]}
        onPressIn={handleHoldStart}
        onPressOut={handleHoldRelease}
        activeOpacity={1}
      >
        {holdPhase === "holding" ? (
          <View style={styles.holdInner}>
            <Text style={[styles.holdText, { fontFamily: "Nunito_900Black" }]}>HOLD</Text>
            <Text style={[styles.holdCountdownText, { fontFamily: "Nunito_700Bold" }]}>Hold... {holdCountdown}s</Text>
          </View>
        ) : (
          <View style={styles.holdInner}>
            <Text style={[styles.holdText, { fontFamily: "Nunito_900Black" }]}>HOLD</Text>
            {holdPhase === "idle" && (
              <Text style={[styles.holdSubtext, { fontFamily: "Nunito_400Regular" }]}>waiting...</Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.resetBtn, { borderColor: colors.border }]}
        onPress={handleReset}
        activeOpacity={0.8}
      >
        <Text style={[styles.resetText, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Reset</Text>
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
  pipsRow: { flexDirection: "row", gap: 8, width: "100%", marginBottom: 24 },
  pip: { height: 8, flex: 1, borderRadius: 4 },
  diffLabel: { fontSize: 13, letterSpacing: 2, marginBottom: 8 },
  commandWord: { fontSize: 52, textAlign: "center", marginBottom: 16 },
  maxPtsLabel: { fontSize: 13, marginBottom: 8 },
  timerContainer: { width: "100%", height: 10, backgroundColor: "#EDE6DE", borderRadius: 5, overflow: "hidden", marginBottom: 8 },
  timerBar: { height: "100%", borderRadius: 5 },
  timerText: { fontSize: 14, marginBottom: 16 },
  bonusBubble: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 8 },
  bonusBubbleText: { fontSize: 14 },
  flashContainer: { marginBottom: 8 },
  flashText: { fontSize: 32 },
  holdButton: { width: 180, height: 180, borderRadius: 90, borderWidth: 3, alignItems: "center", justifyContent: "center", shadowColor: "#FF8B6A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginBottom: 16 },
  holdInner: { alignItems: "center", gap: 4 },
  holdText: { color: "#FFFFFF", fontSize: 24, letterSpacing: 3 },
  holdSubtext: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  holdCountdownText: { color: "#FFFFFF", fontSize: 14 },
  resetBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, marginBottom: 12 },
  resetText: { fontSize: 15 },
  skipText: { fontSize: 14, textDecorationLine: "underline" },
});
