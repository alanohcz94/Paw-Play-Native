import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
  Easing,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type BtnState = "active" | "countdown" | "complete";

export default function BlitzActiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { duration: durationParam } = useLocalSearchParams<{
    duration: string;
  }>();
  const duration = parseInt(durationParam ?? "90", 10);
  const { dog, commands: allCommands } = useApp();

  const markerCue = dog?.markerCue || "Yes";

  const [commands] = useState(() =>
    shuffle(allCommands.filter((c) => c.level >= 1)),
  );

  // ── Display state (drives render) ──────────────────────────────────────
  const [cmdIndex, setCmdIndex] = useState(0);
  const [btnState, setBtnState] = useState<BtnState>("active");
  const [reps, setReps] = useState(0);
  const [score, setScore] = useState(0);
  const [holdDisplay, setHoldDisplay] = useState(0);
  const [timerDisplay, setTimerDisplay] = useState(duration);
  const [flash, setFlash] = useState<{ pts: number; id: number } | null>(null);
  const [countdownStep, setCountdownStep] = useState<
    "Ready" | "Set" | "Go!" | null
  >("Ready");

  // ── Mutable refs (game logic, no re-render needed) ────────────────────
  const cmdIndexRef = useRef(0);
  const btnStateRef = useRef<BtnState>("active");
  const scoreRef = useRef(0);
  const repsRef = useRef(0);
  const holdsRef = useRef(0);
  const cslhRef = useRef(0); // commandsSinceLastHold
  const commandsUsedRef = useRef<string[]>([]);
  const flashIdRef = useRef(0);
  const tapLockRef = useRef(false);
  const sessionEndedRef = useRef(false);

  // ── Reanimated shared values ──────────────────────────────────────────
  // btnColorPhase: 0=colors.peach, 0.5=lavender, 1=mint
  const btnColorPhase = useSharedValue(0);
  const btnScale = useSharedValue(1);
  const cmdTranslateX = useSharedValue(0);
  const cmdScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  const flashY = useSharedValue(0);
  const sessionSV = useSharedValue(duration);
  const holdSV = useSharedValue(0);

  // ── Start session timer after Ready/Set/Go countdown ─────────────────
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const t1 = setTimeout(() => {
      setCountdownStep("Set");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 1000);
    const t2 = setTimeout(() => {
      setCountdownStep("Go!");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 2000);
    const t3 = setTimeout(() => {
      setCountdownStep(null);
      sessionSV.value = withTiming(0, {
        duration: duration * 1000,
        easing: Easing.linear,
      });
    }, 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Session timer reaction ────────────────────────────────────────────
  const handleTimerEnd = useCallback(() => {
    if (sessionEndedRef.current) return;
    if (btnStateRef.current === "countdown") {
      // Let hold finish; transitionToComplete will call endSession
      sessionEndedRef.current = true;
    } else {
      endSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useAnimatedReaction(
    () => Math.ceil(sessionSV.value),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setTimerDisplay)(Math.max(0, cur));
      if (cur <= 0 && prev !== null && prev > 0) runOnJS(handleTimerEnd)();
    },
    [handleTimerEnd],
  );

  // ── Hold countdown reaction ───────────────────────────────────────────
  const transitionToComplete = useCallback(() => {
    if (btnStateRef.current !== "countdown") return;
    btnStateRef.current = "complete";
    setBtnState("complete");
    cancelAnimation(btnScale);
    btnScale.value = withSequence(
      withTiming(1.08, { duration: 100 }),
      withTiming(1.0, { duration: 120 }),
    );
    btnColorPhase.value = withTiming(1, { duration: 200 });
    if (sessionEndedRef.current) {
      // Session timer already expired while we were in hold — end now
      endSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useAnimatedReaction(
    () => holdSV.value,
    (val, prev) => {
      const ceiled = Math.ceil(val);
      const prevCeiled = prev !== null ? Math.ceil(prev) : null;
      if (ceiled !== prevCeiled) runOnJS(setHoldDisplay)(Math.max(0, ceiled));
      if (val <= 0.05 && prev !== null && prev > 0.05)
        runOnJS(transitionToComplete)();
    },
    [transitionToComplete],
  );

  // ── End session ───────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    cancelAnimation(sessionSV);
    cancelAnimation(holdSV);
    router.replace({
      pathname: "/blitz-end",
      params: {
        repsCompleted: String(repsRef.current),
        holdsCompleted: String(holdsRef.current),
        duration: String(duration),
        commandsUsed: JSON.stringify(commandsUsedRef.current),
      },
    });
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Show point flash ──────────────────────────────────────────────────
  const showFlash = useCallback(
    (pts: number) => {
      flashIdRef.current += 1;
      setFlash({ pts, id: flashIdRef.current });
      flashOpacity.value = 1;
      flashY.value = 0;
      flashOpacity.value = withTiming(0, { duration: 800 });
      flashY.value = withTiming(-44, { duration: 800 });
    },
    [flashOpacity, flashY],
  );

  // ── Advance command index ─────────────────────────────────────────────
  const nextCmdIndex = useCallback(() => {
    const next = (cmdIndexRef.current + 1) % Math.max(commands.length, 1);
    cmdIndexRef.current = next;
    return next;
  }, [commands.length]);

  // Track command used
  const trackCommand = useCallback(() => {
    const name = commands[cmdIndexRef.current]?.name;
    if (name && !commandsUsedRef.current.includes(name)) {
      commandsUsedRef.current = [...commandsUsedRef.current, name];
    }
  }, [commands]);

  // ── Slide to next command ─────────────────────────────────────────────
  const slideToNext = useCallback(
    (nextIdx: number, onArrival?: () => void) => {
      cmdTranslateX.value = withTiming(
        -SCREEN_WIDTH,
        { duration: 250, easing: Easing.ease },
        () => {
          runOnJS(setCmdIndex)(nextIdx);
          cmdTranslateX.value = SCREEN_WIDTH;
          cmdTranslateX.value = withTiming(
            0,
            { duration: 250, easing: Easing.ease },
            onArrival ? () => runOnJS(onArrival)() : undefined,
          );
        },
      );
    },
    [cmdTranslateX],
  );

  // ── Trigger hold ──────────────────────────────────────────────────────
  const triggerHold = useCallback(
    (holdSeconds: number) => {
      btnStateRef.current = "countdown";
      setBtnState("countdown");
      cslhRef.current = 0;
      btnColorPhase.value = withTiming(0.5, { duration: 300 });
      holdSV.value = holdSeconds;
      holdSV.value = withTiming(0, {
        duration: holdSeconds * 1000,
        easing: Easing.linear,
      });
      btnScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 500 }),
          withTiming(1.0, { duration: 500 }),
        ),
        -1,
        false,
      );
    },
    [btnColorPhase, holdSV, btnScale],
  );

  // ── Marker tap (State 1) ──────────────────────────────────────────────
  const handleMarkerTap = useCallback(() => {
    if (btnStateRef.current !== "active") return;
    if (tapLockRef.current) return;
    tapLockRef.current = true;
    setTimeout(() => {
      tapLockRef.current = false;
    }, 350);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    trackCommand();
    repsRef.current += 1;
    setReps(repsRef.current);
    cslhRef.current += 1;
    scoreRef.current += 5;
    setScore(scoreRef.current);
    showFlash(5);

    const cslh = cslhRef.current;

    let shouldHold = false;
    if (cslh >= 5) shouldHold = true;
    else if (cslh >= 2) shouldHold = Math.random() < 0.4;

    if (shouldHold) {
      // Keep current command visible during hold; handleHoldComplete advances index
      const holdSec = Math.floor(Math.random() * 12) + 1;
      triggerHold(holdSec);
    } else {
      const next = nextCmdIndex();
      // Brief tick then slide
      cmdScale.value = withSequence(
        withTiming(1.1, { duration: 100 }),
        withTiming(1.0, { duration: 120 }),
      );
      cmdTranslateX.value = withDelay(
        600,
        withTiming(
          -SCREEN_WIDTH,
          { duration: 250, easing: Easing.ease },
          () => {
            runOnJS(setCmdIndex)(next);
            cmdTranslateX.value = SCREEN_WIDTH;
            cmdTranslateX.value = withTiming(0, {
              duration: 250,
              easing: Easing.ease,
            });
          },
        ),
      );
    }
  }, [
    trackCommand,
    showFlash,
    nextCmdIndex,
    triggerHold,
    cmdScale,
    cmdTranslateX,
  ]);

  // ── Hold complete tap (State 3) ───────────────────────────────────────
  const handleHoldComplete = useCallback(() => {
    if (btnStateRef.current !== "complete") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    holdsRef.current += 1;
    scoreRef.current += 10;
    setScore(scoreRef.current);
    showFlash(10);

    btnStateRef.current = "active";
    setBtnState("active");
    btnColorPhase.value = withTiming(0, { duration: 150 });
    cancelAnimation(btnScale);
    btnScale.value = withTiming(1, { duration: 100 });

    const next = nextCmdIndex();
    slideToNext(next);
  }, [showFlash, nextCmdIndex, slideToNext, btnColorPhase, btnScale]);

  // ── Skip (State 1 only) ───────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    if (btnStateRef.current !== "active") return;
    const next = nextCmdIndex();
    slideToNext(next);
    // commandsSinceLastHold unchanged per spec
  }, [nextCmdIndex, slideToNext]);

  // ── Animated styles ───────────────────────────────────────────────────
  const buttonAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      btnColorPhase.value,
      [0, 0.5, 1],
      [colors.peach, colors.lavender, colors.mint],
    ),
    transform: [{ scale: btnScale.value }],
  }));

  const cmdAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cmdTranslateX.value }, { scale: cmdScale.value }],
  }));

  const flashAnimStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    transform: [{ translateY: flashY.value }],
  }));

  const isUrgent = timerDisplay <= 10;
  const currentCmd = commands[cmdIndex]?.name ?? "";
  const btnLabel =
    btnState === "countdown" ? `Hold... ${holdDisplay}s` : markerCue;

  if (countdownStep) {
    const isGo = countdownStep === "Go!";
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
            justifyContent: "center",
          },
        ]}
      >
        <Text
          style={[
            styles.cmdText,
            {
              color: isGo ? colors.dark : colors.mutedForeground,
              fontFamily: "FredokaOne_400Regular",
              marginBottom: 24,
            },
          ]}
        >
          {currentCmd}
        </Text>
        <Text
          style={[
            styles.countdownText,
            {
              color: isGo ? colors.mint : colors.peach,
              fontFamily: "FredokaOne_400Regular",
            },
          ]}
        >
          {countdownStep}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
        },
      ]}
    >
      {/* Row 1: Timer + Score */}
      <View style={[styles.topRow, { top: SCREEN_HEIGHT * 0.30 }]}>
        <Text
          style={[
            styles.timerText,
            {
              color: isUrgent ? colors.peach : colors.dark,
              fontFamily: "Nunito_900Black",
            },
          ]}
        >
          {timerDisplay}s
        </Text>
        <View style={styles.scoreWrap}>
          <View style={[styles.scorePill, { backgroundColor: colors.lemon }]}>
            <Text
              style={[
                styles.scoreText,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              {score} pts
            </Text>
          </View>
          {flash && (
            <Animated.View style={[styles.flashWrap, flashAnimStyle]}>
              <Text
                style={[
                  styles.flashText,
                  { fontFamily: "FredokaOne_400Regular", color: colors.mint },
                ]}
              >
                +{flash.pts}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Row 2: Rep counter */}
      <Text
        style={[
          styles.repText,
          { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
        ]}
      >
        Rep {reps}
      </Text>

      {/* Row 3: Command word */}
      <Animated.View style={[styles.cmdWrap, cmdAnimStyle]}>
        <Text
          style={[
            styles.cmdText,
            { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
          ]}
        >
          {currentCmd}
        </Text>
      </Animated.View>

      {/* Row 4: Marker button (3-state) */}
      <Animated.View style={[styles.markerBtn, buttonAnimStyle]}>
        <TouchableOpacity
          style={styles.markerBtnInner}
          onPress={
            btnState === "active"
              ? handleMarkerTap
              : btnState === "complete"
                ? handleHoldComplete
                : undefined
          }
          disabled={btnState === "countdown"}
          activeOpacity={0.88}
        >
          <Text
            style={[styles.markerBtnText, { fontFamily: "Nunito_900Black" }]}
          >
            {btnLabel}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Row 5: Skip (only visible in State 1) */}
      {btnState === "active" && (
        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          style={styles.skipWrap}
        >
          <Text
            style={[
              styles.skipText,
              { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
            ]}
          >
            Skip →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timerText: { fontSize: 32 },
  scoreWrap: { alignItems: "flex-end" },
  scorePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  scoreText: { fontSize: 15 },
  flashWrap: { position: "absolute", top: -28, right: 0 },
  flashText: { fontSize: 22, color: colors.mint },
  repText: { fontSize: 13, marginBottom: 20 },
  cmdWrap: { width: "100%", alignItems: "center", marginBottom: 32 },
  cmdText: { fontSize: 52, textAlign: "center" },
  markerBtn: {
    width: "100%",
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
  },
  markerBtnInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  markerBtnText: { color: "#fff", fontSize: 18 },
  skipWrap: { marginTop: 4 },
  skipText: { fontSize: 12 },
  countdownText: { fontSize: 72, textAlign: "center" },
});
