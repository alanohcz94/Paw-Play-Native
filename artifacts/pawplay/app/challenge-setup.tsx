import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ALL_COMMANDS, DIFFICULTY_WINDOW } from "@/utils/scoring";
import type { Difficulty } from "@/utils/scoring";

function sampleWithReplacement(pool: string[], count: number): string[] {
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function getCommandCount(diff: Difficulty): number {
  if (diff === "medium") return Math.random() < 0.5 ? 6 : 7;
  if (diff === "expert") return Math.floor(Math.random() * 3) + 6; // 6-8
  return 5;
}

export default function ChallengeSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { commands } = useApp();
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  const pool = useMemo(
    () => commands.length >= 1 ? commands.map((c) => c.name) : ALL_COMMANDS,
    [commands],
  );

  const [sequence, setSequence] = useState<string[]>(() => sampleWithReplacement(pool, getCommandCount("easy")));

  const shuffle = useCallback(() => {
    setSequence(sampleWithReplacement(pool, getCommandCount(difficulty)));
  }, [difficulty, pool]);

  const reshuffleAt = useCallback((index: number) => {
    setSequence(prev => {
      const current = prev[index];
      const others = pool.filter(p => p !== current);
      const pick = others.length > 0 ? others : pool;
      const next = pick[Math.floor(Math.random() * pick.length)];
      return prev.map((cmd, i) => (i === index ? next : cmd));
    });
  }, [pool]);

  useEffect(() => {
    shuffle();
  }, [shuffle]);

  const window = DIFFICULTY_WINDOW[difficulty];

  const difficultyOptions = useMemo(() => [
    { key: "easy" as Difficulty, label: "Easy", color: colors.mint, bg: colors.mintLight },
    { key: "medium" as Difficulty, label: "Medium", color: colors.lemon, bg: colors.lemonLight },
    { key: "expert" as Difficulty, label: "Expert", color: colors.peach, bg: colors.peachLight },
  ], [colors.mint, colors.mintLight, colors.lemon, colors.lemonLight, colors.peach, colors.peachLight]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.dark} />
        </TouchableOpacity>

        <Text style={[styles.header, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Quick Bites</Text>
        <Text style={[styles.subheader, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Randomised command sequence</Text>

        <View style={[styles.infoBox, { backgroundColor: colors.mintLight, borderLeftColor: colors.mint }]}>
          <Text style={[styles.infoText, { color: colors.dark, fontFamily: "Nunito_400Regular" }]}>
            HOLD means your dog holds the position AND keeps focus on you — body still, eyes on handler! Hold the HOLD button while they comply and release when done. Beat the timer for full points — skipping costs points!
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Difficulty</Text>
        <View style={styles.difficultyRow}>
          {difficultyOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.diffPill,
                {
                  backgroundColor: difficulty === opt.key ? opt.bg : colors.card,
                  borderColor: difficulty === opt.key ? opt.color : colors.border,
                  borderWidth: 2,
                },
              ]}
              onPress={() => setDifficulty(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.diffText, { color: difficulty === opt.key ? opt.color : colors.mutedForeground, fontFamily: "Nunito_900Black" }]}>{opt.label}</Text>
              <Text style={[styles.diffWindow, { color: difficulty === opt.key ? opt.color : colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>{DIFFICULTY_WINDOW[opt.key]}s</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Sequence</Text>
        <View style={[styles.sequenceList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sequenceRow, styles.tableHeaderRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.seqNum, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>#</Text>
            <Text style={[styles.seqCmd, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Command</Text>
            <Text style={[styles.seqTime, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Comply</Text>
          </View>
          {sequence.map((cmd, i) => (
            <View key={`${cmd}-${i}`} style={[styles.sequenceRow, i < sequence.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.seqNum, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>{i + 1}</Text>
              <Text style={[styles.seqCmd, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>{cmd}</Text>
              <Text style={[styles.seqTime, { color: colors.peach, fontFamily: "Nunito_700Bold" }]}>{window}s</Text>
              <TouchableOpacity onPress={() => reshuffleAt(i)} hitSlop={8} activeOpacity={0.6} style={styles.rowShuffleBtn}>
                <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.shuffleBtn, { borderColor: colors.border }]} onPress={shuffle} activeOpacity={0.8}>
            <Feather name="shuffle" size={18} color={colors.dark} />
            <Text style={[styles.shuffleText, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.goBtn, { backgroundColor: colors.peach }]}
            onPress={() => router.push({ pathname: "/challenge-active", params: { sequence: JSON.stringify(sequence), difficulty } })}
            activeOpacity={0.85}
          >
            <Text style={[styles.goText, { fontFamily: "Nunito_900Black" }]}>Let's Go!</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { marginBottom: 12, alignSelf: "flex-start" },
  header: { fontSize: 36, marginBottom: 4 },
  subheader: { fontSize: 16, marginBottom: 20 },
  infoBox: { borderLeftWidth: 4, borderRadius: 12, padding: 16, marginBottom: 24 },
  infoText: { fontSize: 14, lineHeight: 21 },
  sectionLabel: { fontSize: 15, marginBottom: 12 },
  difficultyRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  diffPill: { flex: 1, alignItems: "center", borderRadius: 14, paddingVertical: 12 },
  diffText: { fontSize: 15 },
  diffWindow: { fontSize: 12 },
  sequenceList: { borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  tableHeaderRow: { paddingVertical: 10 },
  sequenceRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  seqNum: { width: 20, fontSize: 14 },
  seqCmd: { flex: 1, fontSize: 16 },
  seqTime: { width: 50, fontSize: 14, textAlign: "center" as const },
  rowShuffleBtn: { width: 24, alignItems: "center" },
  actions: { flexDirection: "row", gap: 12 },
  shuffleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 16, paddingVertical: 16 },
  shuffleText: { fontSize: 16 },
  goBtn: { flex: 2, alignItems: "center", borderRadius: 16, paddingVertical: 16, shadowColor: "#FF8B6A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  goText: { color: "#fff", fontSize: 18 },
});
