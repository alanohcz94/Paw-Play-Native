import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, TextInput, Alert, Image, Animated as RNAnimated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

type MasteryLevel = "added" | "learning" | "practising" | "reliable";

function getCommandMastery(cmd: { trainingSessionsCount: number; qbSuccessesCount: number; qbSessionsWithSuccess: number; level: number }): MasteryLevel {
  if (cmd.qbSuccessesCount >= 10 && cmd.qbSessionsWithSuccess >= 3) return "reliable";
  if (cmd.trainingSessionsCount >= 5) return "practising";
  if (cmd.trainingSessionsCount >= 1 || cmd.level >= 1) return "learning";
  return "added";
}

const MASTERY_COLORS: Record<MasteryLevel, { border: string; bg: string; text: string }> = {
  added: { border: "#9CA3AF", bg: "#F3F4F6", text: "#6B7280" },
  learning: { border: "#F5C400", bg: "#FFFBE0", text: "#92780A" },
  practising: { border: "#3DB884", bg: "#E8F8F1", text: "#2D8A63" },
  reliable: { border: "#3B82F6", bg: "#EBF5FF", text: "#1D4ED8" },
};

const MASTERY_LABELS: Record<MasteryLevel, string> = {
  added: "Added",
  learning: "Learning",
  practising: "Practising",
  reliable: "Reliable",
};

function CommandChip({ name, mastery, colors: appColors }: { name: string; mastery: MasteryLevel; colors: any }) {
  const mc = MASTERY_COLORS[mastery];
  return (
    <View style={[styles.commandChip, { backgroundColor: mc.bg, borderColor: mc.border, borderWidth: 1.5 }]}>
      <Text style={[styles.commandChipText, { color: mc.text, fontFamily: "Nunito_700Bold" }]}>{name}</Text>
      {mastery === "reliable" && <Feather name="check" size={12} color={mc.text} />}
    </View>
  );
}

const ACHIEVEMENT_TYPES = [
  { type: "first_session", label: "Starter", icon: "star", description: "Completed your first training session", unlock: "Complete 1 Quick Bites session" },
  { type: "streak_7", label: "7-Day Streak", icon: "zap", description: "Trained with your dog 7 days in a row", unlock: "Train every day for 7 consecutive days" },
  { type: "streak_30", label: "30-Day Streak", icon: "award", description: "A month of consistent daily training", unlock: "Train every day for 30 consecutive days" },
  { type: "perfect_round", label: "Perfect Round", icon: "target", description: "Flawless session — every command on time", unlock: "Complete all 5 commands within the comply window with zero skips" },
  { type: "speed_demon", label: "Speed Demon", icon: "wind", description: "Lightning fast responses from your dog", unlock: "Complete every command in under half the comply window" },
  { type: "family_champion", label: "Family Champ", icon: "trophy", description: "Top of the family leaderboard", unlock: "Beat all family members' session scores" },
  { type: "reliable_handler", label: "Reliable Handler", icon: "shield", description: "Your first command reached expert level", unlock: "Get any command to Level 3 — Reliable" },
  { type: "full_pack", label: "Full Pack", icon: "package", description: "All basic commands mastered", unlock: "Get all 7 basic commands to Level 3 — Reliable" },
  { type: "month_pawfect", label: "Month Pawfect", icon: "calendar", description: "Trained every single day this month", unlock: "Complete a session every day in a calendar month" },
];

function AchievementBadge({ ach, unlocked, colors }: { ach: typeof ACHIEVEMENT_TYPES[0]; unlocked: boolean; colors: any }) {
  const [showInfo, setShowInfo] = useState(false);
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  const handlePress = () => {
    if (unlocked) {
      RNAnimated.sequence([
        RNAnimated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true, friction: 3 }),
        RNAnimated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
      ]).start();
    } else {
      RNAnimated.sequence([
        RNAnimated.timing(scaleAnim, { toValue: 0.95, duration: 50, useNativeDriver: true }),
        RNAnimated.timing(scaleAnim, { toValue: 1.05, duration: 50, useNativeDriver: true }),
        RNAnimated.timing(scaleAnim, { toValue: 0.95, duration: 50, useNativeDriver: true }),
        RNAnimated.timing(scaleAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      ]).start();
      setShowInfo(!showInfo);
    }
  };

  return (
    <View style={styles.achievementWrapper}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <RNAnimated.View style={[
          styles.achievementBadge,
          {
            backgroundColor: unlocked ? colors.mintLight : colors.card,
            borderColor: unlocked ? colors.mint : colors.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
          <Feather name={ach.icon as any} size={24} color={unlocked ? colors.mint : colors.mutedForeground} />
          <Text style={[styles.achievementLabel, { color: unlocked ? colors.mint : colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>{ach.label}</Text>
          {!unlocked && <Feather name="lock" size={10} color={colors.mutedForeground} />}
        </RNAnimated.View>
      </TouchableOpacity>
      {showInfo && !unlocked && (
        <View style={[styles.unlockPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.unlockDesc, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>{ach.description}</Text>
          <Text style={[styles.unlockHow, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>{ach.unlock}</Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { dog, commands, streak, setDog } = useApp();
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [releaseCue, setReleaseCue] = useState(dog?.releaseCue ?? "Free");
  const [markerCue, setMarkerCue] = useState(dog?.markerCue ?? "Yes");
  const [uploading, setUploading] = useState(false);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  const level3Count = commands.filter((c) => c.level >= 3 || (c.qbSuccessesCount >= 10 && c.qbSessionsWithSuccess >= 3)).length;

  const LEVEL_TITLES: Record<number, string> = {
    1: "Puppy Pal",
    2: "Treat Chaser",
    3: "Good Pup",
    4: "Reliable Rover",
    5: "Champion Chaser",
  };

  const level = dog?.level ?? 1;
  const levelTitle = LEVEL_TITLES[Math.min(level, 5)] ?? "Champion";

  const handleAvatarPick = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo access to update your dog's profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) return;

      setUploading(true);
      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;

      if (dog?.id && user?.id) {
        try {
          const { getItemAsync } = await import("expo-secure-store");
          const token = await getItemAsync("auth_session_token");
          await fetch(`${apiBase}/api/dogs/${dog.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ avatarUrl: dataUrl }),
          });
        } catch (e) {
          console.error(e);
        }
      }

      if (dog) {
        setDog({ ...dog, avatarUrl: dataUrl });
      }
      setUploading(false);
      Alert.alert("Profile photo updated!");
    } catch (e) {
      setUploading(false);
      Alert.alert("Upload failed", "Please try again.");
    }
  };

  const saveCueWords = async () => {
    if (!dog?.id || !user?.id) return;
    try {
      const { getItemAsync } = await import("expo-secure-store");
      const token = await getItemAsync("auth_session_token");
      await fetch(`${apiBase}/api/dogs/${dog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ releaseCue, markerCue }),
      });
      setDog({ ...dog, releaseCue, markerCue });
      setEditMode(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24), paddingBottom: 100 + (Platform.OS === "web" ? 34 : insets.bottom) }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatarPick} activeOpacity={0.7}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.peachLight, borderColor: colors.peach }]}>
            {dog?.avatarUrl ? (
              <Image source={{ uri: dog.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarEmoji}>🐾</Text>
            )}
            {uploading && (
              <View style={styles.avatarOverlay}>
                <Text style={styles.avatarOverlayText}>...</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
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
          <Text style={[styles.statValue, { color: "#3B82F6", fontFamily: "FredokaOne_400Regular" }]}>{level3Count}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Reliable</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Cue Words</Text>
        <TouchableOpacity onPress={() => editMode ? saveCueWords() : setEditMode(true)} activeOpacity={0.7}>
          <Text style={[styles.editBtn, { color: colors.peach, fontFamily: "Nunito_700Bold" }]}>{editMode ? "Save" : "Edit"}</Text>
        </TouchableOpacity>
      </View>
      {editMode ? (
        <View style={[styles.cueCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cueLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Release cue word</Text>
          <TextInput
            style={[styles.cueInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.dark, fontFamily: "Nunito_400Regular" }]}
            value={releaseCue}
            onChangeText={setReleaseCue}
            placeholder="Free"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={[styles.cueExamples, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>e.g. Free, OK, Release, Break</Text>

          <Text style={[styles.cueLabel, { color: colors.dark, fontFamily: "Nunito_700Bold", marginTop: 12 }]}>Marker cue word</Text>
          <TextInput
            style={[styles.cueInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.dark, fontFamily: "Nunito_400Regular" }]}
            value={markerCue}
            onChangeText={setMarkerCue}
            placeholder="Yes"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={[styles.cueExamples, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>e.g. Yes, Mark, Good</Text>
        </View>
      ) : (
        <View style={[styles.cueCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cueRow}>
            <Text style={[styles.cueRowLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Release:</Text>
            <Text style={[styles.cueRowValue, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>{dog?.releaseCue ?? "Free"}</Text>
          </View>
          <View style={styles.cueRow}>
            <Text style={[styles.cueRowLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Marker:</Text>
            <Text style={[styles.cueRowValue, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>{dog?.markerCue ?? "Yes"}</Text>
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Command Library</Text>

      {level3Count > 0 && (
        <View style={[styles.obedienceGate, { backgroundColor: colors.skyLight, borderColor: "#3B82F6" }]}>
          <Text style={[styles.gateText, { color: "#1D4ED8", fontFamily: "Nunito_900Black" }]}>{level3Count} of 7 commands Reliable</Text>
          <View style={[styles.gateBar, { backgroundColor: colors.muted }]}>
            <View style={[styles.gateFill, { width: `${Math.min(100, (level3Count / 7) * 100)}%`, backgroundColor: "#3B82F6" }]} />
          </View>
          {level3Count >= 7 && (
            <Text style={[styles.gateUnlocked, { color: "#3B82F6", fontFamily: "Nunito_700Bold" }]}>Obedience Challenge unlocked!</Text>
          )}
        </View>
      )}

      {commands.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>No commands yet. Add some from the Training screen!</Text>
        </View>
      ) : (
        <View style={styles.commandsGrid}>
          {commands.map((cmd) => {
            const mastery = getCommandMastery(cmd);
            return <CommandChip key={cmd.id} name={cmd.name} mastery={mastery} colors={colors} />;
          })}
        </View>
      )}

      <View style={styles.masteryLegend}>
        {(["added", "learning", "practising", "reliable"] as MasteryLevel[]).map((m) => (
          <View key={m} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MASTERY_COLORS[m].border }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>{MASTERY_LABELS[m]}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Achievements</Text>
      <View style={styles.achievementsGrid}>
        {ACHIEVEMENT_TYPES.map((ach) => (
          <AchievementBadge key={ach.type} ach={ach} unlocked={false} colors={colors} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  avatarSection: { alignItems: "center", gap: 8, marginBottom: 28 },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarEmoji: { fontSize: 48 },
  avatarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center", borderRadius: 45 },
  avatarOverlayText: { color: "#fff", fontSize: 18 },
  dogName: { fontSize: 32 },
  dogBreed: { fontSize: 16 },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
  levelText: { fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: "center", gap: 4 },
  statValue: { fontSize: 28 },
  statLabel: { fontSize: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 18, marginBottom: 14 },
  editBtn: { fontSize: 15 },
  cueCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 24 },
  cueLabel: { fontSize: 14, marginBottom: 6 },
  cueInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15, marginBottom: 4 },
  cueExamples: { fontSize: 12, marginBottom: 4 },
  cueRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  cueRowLabel: { fontSize: 14, width: 70 },
  cueRowValue: { fontSize: 16 },
  obedienceGate: { borderRadius: 16, padding: 16, borderWidth: 1.5, marginBottom: 16 },
  gateText: { fontSize: 14, marginBottom: 8 },
  gateBar: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  gateFill: { height: "100%", borderRadius: 4 },
  gateUnlocked: { fontSize: 13, marginTop: 4 },
  commandsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  commandChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  commandChipText: { fontSize: 14 },
  masteryLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11 },
  emptyCard: { borderRadius: 16, padding: 20, marginBottom: 28 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  achievementWrapper: { width: "30%" },
  achievementBadge: { alignItems: "center", padding: 14, borderRadius: 16, gap: 8, borderWidth: 1 },
  achievementLabel: { fontSize: 11, textAlign: "center" },
  unlockPanel: { borderRadius: 12, padding: 10, marginTop: 4, borderWidth: 1 },
  unlockDesc: { fontSize: 12, marginBottom: 4 },
  unlockHow: { fontSize: 11, lineHeight: 16 },
});
