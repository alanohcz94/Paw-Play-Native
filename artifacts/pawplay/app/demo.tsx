import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";
import { calculateScore, DIFFICULTY_WINDOW } from "@/utils/scoring";
import type { Difficulty, RawCommandInput, ScoreResult } from "@/utils/scoring";

const DEMO_COMMANDS = ["Sit", "Down", "Come"];
const DEMO_DIFFICULTY: Difficulty = "easy";
const DEMO_DOG = "Buddy";

type Phase = "setup" | "active" | "end";

export default function DemoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [commandIndex, setCommandIndex] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [holdCountdown, setHoldCountdown] = useState(0);
  const timerAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturedElapsed = useRef(0);
  const [timeRemaining, setTimeRemaining] = useState(DIFFICULTY_WINDOW[DEMO_DIFFICULTY]);
  const [windowExceeded, setWindowExceeded] = useState(false);
  const elapsedRef = useRef(0);
  const inputsRef = useRef<RawCommandInput[]>([]);
  const [finalResult, setFinalResult] = useState<ScoreResult | null>(null);

  const currentCommand = DEMO_COMMANDS[commandIndex];
  const windowSec = DIFFICULTY_WINDOW[DEMO_DIFFICULTY];

  useEffect(() => {
    if (phase === "active") {
      resetTimer();
    }
    return () => clearTimerInterval();
  }, [phase, commandIndex]);

  const clearTimerInterval = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetTimer = () => {
    clearTimerInterval();
    setTimeRemaining(windowSec);
    setWindowExceeded(false);
    elapsedRef.current = 0;
    timerAnim.setValue(1);

    Animated.timing(timerAnim, {
      toValue: 0,
      duration: windowSec * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      elapsedRef.current += 0.1;
      const remaining = windowSec - elapsedRef.current;
      if (remaining <= 0) {
        setWindowExceeded(true);
        setTimeRemaining(parseFloat(remaining.toFixed(1)));
      } else {
        setTimeRemaining(parseFloat(remaining.toFixed(1)));
      }
    }, 100);
  };

  const handleHoldStart = () => {
    if (isHolding) return;
    setIsHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    clearTimerInterval();
    capturedElapsed.current = elapsedRef.current;

    const holdDuration = Math.floor(Math.random() * 3) + 1;
    setHoldCountdown(holdDuration);

    let remaining = holdDuration;
    holdTimerRef.current = setInterval(() => {
      remaining--;
      setHoldCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(holdTimerRef.current!);
        holdTimerRef.current = null;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsHolding(false);
        setHoldCountdown(0);

        const elapsed = capturedElapsed.current;
        const newInput: RawCommandInput = {
          name: currentCommand,
          skipped: false,
          timeSeconds: elapsed,
          windowSeconds: windowSec,
        };
        const newInputs = [...inputsRef.current, newInput];
        inputsRef.current = newInputs;
        advanceCommand(newInputs);
      }
    }, 1000);
  };

  const handleHoldEnd = () => {
    if (!isHolding) return;
    // Released too early — reset and let them try again
    if (holdCountdown > 0) {
      clearInterval(holdTimerRef.current!);
      holdTimerRef.current = null;
      setIsHolding(false);
      setHoldCountdown(0);
      resetTimer();
    }
  };

  const handleSkip = () => {
    clearTimerInterval();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const elapsed = elapsedRef.current;
    const newInput: RawCommandInput = {
      name: currentCommand,
      skipped: true,
      timeSeconds: elapsed,
      windowSeconds: windowSec,
    };
    const newInputs = [...inputsRef.current, newInput];
    inputsRef.current = newInputs;
    advanceCommand(newInputs);
  };

  const advanceCommand = (allInputs: RawCommandInput[]) => {
    const result = calculateScore(allInputs, DEMO_DIFFICULTY);
    setDisplayScore(Math.max(0, result.participationPoints));

    if (commandIndex + 1 >= DEMO_COMMANDS.length) {
      setFinalResult(result);
      setPhase("end");
    } else {
      setCommandIndex((i) => i + 1);
    }
  };

  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ["#ef4444", "#ef4444", colors.mint],
  });

  const endScore = finalResult ? Math.max(0, finalResult.participationPoints) : displayScore;

  if (phase === "setup") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <Text style={[styles.header, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Quick Bites</Text>
        <Text style={[styles.subheader, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          Let's try a quick demo with {DEMO_DOG}
        </Text>
        <View style={[styles.infoBox, { backgroundColor: colors.mintLight, borderLeftColor: colors.mint }]}>
          <Text style={[styles.infoText, { color: colors.dark, fontFamily: "Nunito_400Regular" }]}>
            When your dog starts to comply, press and hold the HOLD button. Release when they complete the behaviour.
          </Text>
        </View>
        <View style={styles.commandsList}>
          {DEMO_COMMANDS.map((cmd) => (
            <View key={cmd} style={[styles.commandRow, { borderColor: colors.border }]}>
              <Text style={[styles.commandName, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>{cmd}</Text>
              <Text style={[styles.commandDuration, { color: colors.peach, fontFamily: "Nunito_700Bold" }]}>{windowSec}s</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.peach }]}
          onPress={() => setPhase("active")}
          activeOpacity={0.85}
        >
          <Text style={[styles.startButtonText, { fontFamily: "Nunito_900Black" }]}>Let's Go!</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === "active") {
    const timerDisplay = windowExceeded
      ? `-${Math.abs(timeRemaining).toFixed(1)}s over`
      : `${timeRemaining.toFixed(1)}s remaining`;

    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <View style={styles.topBar}>
          <Text style={[styles.counter, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
            {commandIndex + 1} of {DEMO_COMMANDS.length}
          </Text>
          <View style={[styles.scorePill, { backgroundColor: colors.lemon }]}>
            <Text style={[styles.scoreText, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>{displayScore} pts</Text>
          </View>
        </View>

        <View style={styles.pipsRow}>
          {DEMO_COMMANDS.map((_, i) => (
            <View key={i} style={[styles.pip, { backgroundColor: i < commandIndex ? colors.peach : i === commandIndex ? colors.peachMid : colors.muted }]} />
          ))}
        </View>

        <Text style={[styles.commandWord, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{currentCommand}</Text>

        <View style={styles.timerContainer}>
          <Animated.View style={[styles.timerBar, { width: timerAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }), backgroundColor: timerColor }]} />
        </View>
        <Text style={[styles.timerText, { color: windowExceeded ? "#ef4444" : colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          {timerDisplay}
        </Text>

        <TouchableOpacity
          style={[styles.holdButton, { borderColor: isHolding ? colors.mint : colors.peachMid, backgroundColor: isHolding ? colors.mint : colors.peach }]}
          onPressIn={handleHoldStart}
          onPressOut={handleHoldEnd}
          activeOpacity={1}
        >
          {isHolding ? (
            <View style={styles.holdInner}>
              <Text style={[styles.holdText, { fontFamily: "Nunito_900Black" }]}>HOLD</Text>
              <Text style={[styles.holdCountdownText, { fontFamily: "Nunito_700Bold" }]}>Hold... {holdCountdown}s</Text>
            </View>
          ) : (
            <View style={styles.holdInner}>
              <Text style={[styles.holdText, { fontFamily: "Nunito_900Black" }]}>HOLD</Text>
              <Text style={[styles.holdSubtext, { fontFamily: "Nunito_400Regular" }]}>waiting...</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>skip command</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) }]}>
      <Text style={[styles.endTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{DEMO_DOG} did great!</Text>
      <Text style={[styles.endSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Session Complete!</Text>
      <Text style={[styles.endScore, { color: colors.peach, fontFamily: "FredokaOne_400Regular" }]}>{endScore}</Text>
      <Text style={[styles.endScoreLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>Participation Points</Text>

      {finalResult && finalResult.bonuses.length > 0 && (
        <View style={styles.bonusSection}>
          <Text style={[styles.bonusTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Bonuses</Text>
          <View style={styles.bonusChips}>
            {finalResult.bonuses.map((b) => (
              <View key={b.name} style={[styles.bonusChip, { backgroundColor: colors.lavLight }]}>
                <Text style={[styles.bonusChipText, { color: colors.lavender, fontFamily: "Nunito_700Bold" }]}>{b.label} +{b.points}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.messageBox, { backgroundColor: colors.lavLight }]}>
        <Text style={[styles.messageText, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
          Great session! Sign in to save {DEMO_DOG}'s progress and start your real training journey.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.signInButton, { backgroundColor: colors.peach }]}
        onPress={() => login()}
        activeOpacity={0.85}
      >
        <Text style={[styles.signInButtonText, { fontFamily: "Nunito_900Black" }]}>Create Account / Sign In</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginTop: 12 }}>
        <Text style={[styles.backText, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  header: { fontSize: 36, marginTop: 24, marginBottom: 4 },
  subheader: { fontSize: 16, marginBottom: 24, textAlign: "center" },
  infoBox: { borderLeftWidth: 4, borderRadius: 12, padding: 16, marginBottom: 24, width: "100%" },
  infoText: { fontSize: 15, lineHeight: 22 },
  commandsList: { width: "100%", marginBottom: 32, gap: 0 },
  commandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  commandName: { fontSize: 16 },
  commandDuration: { fontSize: 15 },
  startButton: { width: "100%", paddingVertical: 18, borderRadius: 16, alignItems: "center", shadowColor: "#FF8B6A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  startButtonText: { color: "#FFFFFF", fontSize: 18 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: 16, marginBottom: 12 },
  counter: { fontSize: 16 },
  scorePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  scoreText: { fontSize: 15 },
  pipsRow: { flexDirection: "row", gap: 8, marginBottom: 32 },
  pip: { height: 8, flex: 1, borderRadius: 4 },
  commandWord: { fontSize: 52, textAlign: "center", marginBottom: 32 },
  timerContainer: { width: "100%", height: 10, backgroundColor: "#EDE6DE", borderRadius: 5, overflow: "hidden", marginBottom: 8 },
  timerBar: { height: "100%", borderRadius: 5 },
  timerText: { fontSize: 14, marginBottom: 48 },
  holdButton: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, alignItems: "center", justifyContent: "center", shadowColor: "#FF8B6A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginBottom: 24 },
  holdInner: { alignItems: "center", gap: 4 },
  holdText: { color: "#FFFFFF", fontSize: 22, letterSpacing: 3 },
  holdCountdownText: { color: "#FFFFFF", fontSize: 14 },
  holdSubtext: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  skipText: { fontSize: 14, textDecorationLine: "underline" },
  endTitle: { fontSize: 32, marginTop: 32, marginBottom: 4 },
  endSubtitle: { fontSize: 18, marginBottom: 24 },
  endScore: { fontSize: 72, lineHeight: 80 },
  endScoreLabel: { fontSize: 14, marginBottom: 24 },
  bonusSection: { width: "100%", marginBottom: 16 },
  bonusTitle: { fontSize: 15, marginBottom: 10 },
  bonusChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bonusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  bonusChipText: { fontSize: 13 },
  messageBox: { borderRadius: 16, padding: 20, width: "100%", marginBottom: 24 },
  messageText: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  signInButton: { width: "100%", paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  signInButtonText: { color: "#FFFFFF", fontSize: 17 },
  backText: { fontSize: 15 },
});
