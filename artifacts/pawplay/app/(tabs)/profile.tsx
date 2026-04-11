import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

const LEVEL_TITLES: Record<number, string> = {
  1: "Puppy Pal",
  2: "Treat Chaser",
  3: "Good Pup",
  4: "Reliable Rover",
  5: "Champion Chaser",
};

function CommandChip({ name, level, colors }: { name: string; level: number; colors: any }) {
  const bg = level >= 3 ? colors.mint : level === 2 ? colors.mintLight : "transparent";
  const border = level >= 3 ? colors.mint : level === 2 ? colors.mint : colors.border;
  const textColor = level >= 3 ? "#fff" : level === 2 ? colors.mint : colors.mutedForeground;

  return (
    <View style={[styles.commandChip, { backgroundColor: bg, borderColor: border, borderWidth: 1.5 }]}>
      <Text style={[styles.commandChipText, { color: textColor, fontFamily: "Nunito_700Bold" }]}>{name}</Text>
      {level >= 3 && <Feather name="check" size={12} color="#fff" />}
    </View>
  );
}

const ACHIEVEMENT_TYPES = [
  { type: "first_session", label: "First Session", icon: "star" },
  { type: "streak_7", label: "7-Day Streak", icon: "zap" },
  { type: "perfect_round", label: "Perfect Round", icon: "award" },
  { type: "speed_demon", label: "Speed Demon", icon: "wind" },
  { type: "family_champion", label: "Family Champion", icon: "trophy" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { dog, commands, streak } = useApp();
  const { user } = useAuth();

  const level = dog?.level ?? 1;
  const levelTitle = LEVEL_TITLES[Math.min(level, 5)] ?? "Champion";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24), paddingBottom: 100 + (Platform.OS === "web" ? 34 : insets.bottom) }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarSection}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.peachLight, borderColor: colors.peach }]}>
          <Text style={styles.avatarEmoji}>🐾</Text>
        </View>
        <Text style={[styles.dogName, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{dog?.name ?? "Your Dog"}</Text>
        {dog?.breed && <Text style={[styles.dogBreed, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>{dog.breed}</Text>}
        <View style={[styles.levelBadge, { backgroundColor: colors.lavLight }]}>
          <Text style={[styles.levelText, { color: colors.lavender, fontFamily: "Nunito_900Black" }]}>Lv.{level} · {levelTitle}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.peach, fontFamily: "FredokaOne_400Regular" }]}>{streak}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Streak</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.mint, fontFamily: "FredokaOne_400Regular" }]}>{commands.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Commands</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.lavender, fontFamily: "FredokaOne_400Regular" }]}>{commands.filter(c => c.level >= 3).length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Reliable</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Command Library</Text>
      {commands.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>No commands yet. Add some from the Training screen!</Text>
        </View>
      ) : (
        <View style={styles.commandsGrid}>
          {commands.map((cmd) => (
            <CommandChip key={cmd.id} name={cmd.name} level={cmd.level} colors={colors} />
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Achievements</Text>
      <View style={styles.achievementsGrid}>
        {ACHIEVEMENT_TYPES.map((ach) => (
          <View key={ach.type} style={[styles.achievementBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={ach.icon as any} size={24} color={colors.mutedForeground} />
            <Text style={[styles.achievementLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>{ach.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  avatarSection: { alignItems: "center", gap: 8, marginBottom: 28 },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  avatarEmoji: { fontSize: 48 },
  dogName: { fontSize: 32 },
  dogBreed: { fontSize: 16 },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
  levelText: { fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: "center", gap: 4 },
  statValue: { fontSize: 28 },
  statLabel: { fontSize: 12 },
  sectionTitle: { fontSize: 18, marginBottom: 14 },
  commandsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 },
  commandChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  commandChipText: { fontSize: 14 },
  emptyCard: { borderRadius: 16, padding: 20, marginBottom: 28 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  achievementBadge: { width: "30%", alignItems: "center", padding: 14, borderRadius: 16, gap: 8, borderWidth: 1 },
  achievementLabel: { fontSize: 11, textAlign: "center" },
});
