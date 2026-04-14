import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Alert,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";
import { ALL_COMMANDS } from "@/utils/scoring";

type MasteryLevel = "added" | "learning" | "reliable";

function getCommandMastery(cmd: {
  trainingSessionsCount: number;
  qbSuccessesCount: number;
}): MasteryLevel {
  const total = cmd.trainingSessionsCount + cmd.qbSuccessesCount;
  if (total >= 100) return "reliable";
  if (total >= 1) return "learning";
  return "added";
}

const MASTERY_COLORS: Record<
  MasteryLevel,
  { border: string; bg: string; text: string }
> = {
  added: { border: "#9CA3AF", bg: "#F3F4F6", text: "#6B7280" },
  learning: { border: "#22C55E", bg: "#F0FDF4", text: "#15803D" },
  reliable: { border: "#3B82F6", bg: "#EBF5FF", text: "#1D4ED8" },
};

const MASTERY_LABELS: Record<MasteryLevel, string> = {
  added: "Added",
  learning: "Learning",
  reliable: "Reliable",
};

function CommandChip({
  name,
  mastery,
  onPress,
}: {
  name: string;
  mastery: MasteryLevel;
  onPress: () => void;
}) {
  const mc = MASTERY_COLORS[mastery];
  return (
    <TouchableOpacity
      style={[
        styles.commandChip,
        { backgroundColor: mc.bg, borderColor: mc.border, borderWidth: 1.5 },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.commandChipText,
          { color: mc.text, fontFamily: "Nunito_700Bold" },
        ]}
      >
        {name}
      </Text>
      {mastery === "reliable" && (
        <Feather name="check" size={12} color={mc.text} />
      )}
    </TouchableOpacity>
  );
}

const ACHIEVEMENT_TYPES = [
  { type: "first_session" },
  { type: "streak_7" },
  { type: "streak_30" },
  { type: "reliable_handler" },
  { type: "full_pack" },
  { type: "perfect_round" },
  { type: "speed_demon" },
  { type: "family_champion" },
  { type: "month_pawfect" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { dog, dogs, commands, streak, setDog, setCommands } = useApp();
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [releaseCue, setReleaseCue] = useState(dog?.releaseCue ?? "Free");
  const [markerCue, setMarkerCue] = useState(dog?.markerCue ?? "Yes");
  const [uploading, setUploading] = useState(false);
  const [showAddCommands, setShowAddCommands] = useState(false);
  const [addingCommand, setAddingCommand] = useState<string | null>(null);
  const [customCommandInput, setCustomCommandInput] = useState("");
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";

  const level3Count = commands.filter(
    (c) =>
      c.level >= 3 ||
      (c.qbSuccessesCount >= 10 && c.qbSessionsWithSuccess >= 3),
  ).length;

  const hasAnySessions = commands.some(
    (c) => c.trainingSessionsCount > 0 || c.qbSuccessesCount > 0,
  );

  const unlockedAchievements = new Set<string>();
  if (hasAnySessions) unlockedAchievements.add("first_session");
  if (streak >= 7) unlockedAchievements.add("streak_7");
  if (streak >= 30) unlockedAchievements.add("streak_30");
  if (level3Count >= 1) unlockedAchievements.add("reliable_handler");
  if (level3Count >= 7) unlockedAchievements.add("full_pack");

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
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow photo access to update your dog's profile picture.",
        );
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
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ releaseCue, markerCue }),
      });
      setDog({ ...dog, releaseCue, markerCue });
      setEditMode(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCommand = async (name: string) => {
    if (!dog?.id || addingCommand) return;
    setAddingCommand(name);
    try {
      const { getItemAsync } = await import("expo-secure-store");
      const token = await getItemAsync("auth_session_token");
      await fetch(`${apiBase}/api/dogs/${dog.id}/commands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });
      const cmdsRes = await fetch(`${apiBase}/api/dogs/${dog.id}/commands`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cmdsRes.ok) {
        const { commands: updated } = await cmdsRes.json();
        setCommands(updated);
      }
    } catch (e) {
      Alert.alert("Error", "Could not add command. Please try again.");
    } finally {
      setAddingCommand(null);
    }
  };

  const selectedCmd = selectedCommandId ? (commands.find((c) => c.id === selectedCommandId) ?? null) : null;
  const ttReps = selectedCmd ? selectedCmd.trainingSessionsCount + selectedCmd.qbSuccessesCount : 0;
  const ttMastery: MasteryLevel = selectedCmd ? getCommandMastery(selectedCmd) : "added";
  const ttMc = MASTERY_COLORS[ttMastery];
  const ttNextTarget = ttMastery === "added" ? 1 : 100;
  const ttNextLabel = ttMastery === "added" ? "Learning" : "Reliable";
  const ttPct = ttMastery === "reliable" ? 100 : Math.min(100, Math.round((ttReps / ttNextTarget) * 100));

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
          paddingBottom: 100 + (Platform.OS === "web" ? 34 : insets.bottom),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrapper}>
          <TouchableOpacity onPress={handleAvatarPick} activeOpacity={0.7}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.peachLight, borderColor: colors.peach },
              ]}
            >
              {dog?.avatarUrl ? (
                <Image
                  source={{ uri: dog.avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarEmoji}>🐾</Text>
              )}
              {uploading ? (
                <View style={styles.avatarOverlay}>
                  <Text style={styles.avatarOverlayText}>...</Text>
                </View>
              ) : (
                <View style={styles.avatarCameraOverlay}>
                  <Feather name="camera" size={16} color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
        <Text
          style={[
            styles.dogName,
            { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
          ]}
        >
          {dog?.name ?? "Your Dog"}
        </Text>
        {dog?.breed && (
          <Text
            style={[
              styles.dogBreed,
              {
                color: colors.mutedForeground,
                fontFamily: "Nunito_400Regular",
              },
            ]}
          >
            {dog.breed}
          </Text>
        )}
        <View style={[styles.levelBadge, { backgroundColor: colors.lavLight }]}>
          <Text
            style={[
              styles.levelText,
              { color: colors.lavender, fontFamily: "Nunito_900Black" },
            ]}
          >
            Lv.{level} · {levelTitle}
          </Text>
        </View>

        {dogs.length > 1 && (
          <Text style={[styles.dogCountLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
            {dogs.length} dogs in your family
          </Text>
        )}

        <TouchableOpacity
          style={[styles.addDogBtn, { backgroundColor: colors.mintLight, borderColor: colors.mint }]}
          onPress={() => router.push("/add-dog")}
          activeOpacity={0.85}
        >
          <Feather name="plus-circle" size={16} color={colors.mint} />
          <Text style={[styles.addDogBtnText, { color: colors.mint, fontFamily: "Nunito_700Bold" }]}>Add Another Dog</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text
            style={[
              styles.statValue,
              { color: colors.peach, fontFamily: "FredokaOne_400Regular" },
            ]}
          >
            {streak}
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
            ]}
          >
            Streak
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text
            style={[
              styles.statValue,
              { color: colors.mint, fontFamily: "FredokaOne_400Regular" },
            ]}
          >
            {commands.length}
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
            ]}
          >
            Commands
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text
            style={[
              styles.statValue,
              { color: "#3B82F6", fontFamily: "FredokaOne_400Regular" },
            ]}
          >
            {level3Count}
          </Text>
          <Text
            style={[
              styles.statLabel,
              { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
            ]}
          >
            Reliable
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.dark, fontFamily: "Nunito_900Black" },
          ]}
        >
          Cue Words
        </Text>
        <TouchableOpacity
          onPress={() => (editMode ? saveCueWords() : setEditMode(true))}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.editBtn,
              { color: colors.peach, fontFamily: "Nunito_700Bold" },
            ]}
          >
            {editMode ? "Save" : "Edit"}
          </Text>
        </TouchableOpacity>
      </View>
      {editMode ? (
        <View
          style={[
            styles.cueCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.cueLabel,
              { color: colors.dark, fontFamily: "Nunito_700Bold" },
            ]}
          >
            Release cue word
          </Text>
          <TextInput
            style={[
              styles.cueInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.dark,
                fontFamily: "Nunito_400Regular",
              },
            ]}
            value={releaseCue}
            onChangeText={setReleaseCue}
            placeholder="Free"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text
            style={[
              styles.cueExamples,
              {
                color: colors.mutedForeground,
                fontFamily: "Nunito_400Regular",
              },
            ]}
          >
            e.g. Free, OK, Release, Break
          </Text>

          <Text
            style={[
              styles.cueLabel,
              {
                color: colors.dark,
                fontFamily: "Nunito_700Bold",
                marginTop: 12,
              },
            ]}
          >
            Marker cue word
          </Text>
          <TextInput
            style={[
              styles.cueInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.dark,
                fontFamily: "Nunito_400Regular",
              },
            ]}
            value={markerCue}
            onChangeText={setMarkerCue}
            placeholder="Yes"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text
            style={[
              styles.cueExamples,
              {
                color: colors.mutedForeground,
                fontFamily: "Nunito_400Regular",
              },
            ]}
          >
            e.g. Yes, Mark, Good
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.cueCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.cueRow}>
            <Text
              style={[
                styles.cueRowLabel,
                { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
              ]}
            >
              Release:
            </Text>
            <Text
              style={[
                styles.cueRowValue,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              {dog?.releaseCue ?? "Free"}
            </Text>
          </View>
          <View style={styles.cueRow}>
            <Text
              style={[
                styles.cueRowLabel,
                { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
              ]}
            >
              Marker:
            </Text>
            <Text
              style={[
                styles.cueRowValue,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              {dog?.markerCue ?? "Yes"}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black", marginBottom: 0 }]}>Command Library</Text>
        <TouchableOpacity
          style={[styles.addCommandBtn, { backgroundColor: colors.peach }]}
          onPress={() => setShowAddCommands((v) => !v)}
          activeOpacity={0.85}
        >
          <Feather name={showAddCommands ? "x" : "plus"} size={14} color="#fff" />
          <Text style={[styles.addCommandBtnText, { fontFamily: "Nunito_700Bold" }]}>
            {showAddCommands ? "Close" : "Add Command"}
          </Text>
        </TouchableOpacity>
      </View>

      {showAddCommands && (() => {
        const PRESET_SUGGESTIONS = ["Shake", "Hi-5", "Hop/Over", "Up", "Home", "Roll Over", "Spin", "Fetch", "Drop It", "Wait"];
        const ALL_SUGGESTIONS = [...ALL_COMMANDS, ...PRESET_SUGGESTIONS];
        const ownedNames = new Set(commands.map((c) => c.name));
        const available = ALL_SUGGESTIONS.filter((cmd) => !ownedNames.has(cmd));
        return (
          <View style={[styles.addCommandPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.addCommandHint, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
              Tap a suggestion or type your own
            </Text>
            {available.length > 0 && (
              <View style={styles.commandsGrid}>
                {available.map((cmd) => (
                  <TouchableOpacity
                    key={cmd}
                    style={[styles.commandChip, { backgroundColor: colors.peachLight, borderColor: colors.peach, borderWidth: 1.5, opacity: addingCommand === cmd ? 0.5 : 1 }]}
                    onPress={() => handleAddCommand(cmd)}
                    disabled={!!addingCommand}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.commandChipText, { color: colors.peach, fontFamily: "Nunito_700Bold" }]}>
                      {addingCommand === cmd ? "Adding…" : `+ ${cmd}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={[styles.customInputRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.customInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.dark, fontFamily: "Nunito_400Regular" }]}
                value={customCommandInput}
                onChangeText={setCustomCommandInput}
                placeholder="Custom command…"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => {
                  const trimmed = customCommandInput.trim();
                  if (trimmed) { handleAddCommand(trimmed); setCustomCommandInput(""); }
                }}
              />
              <TouchableOpacity
                style={[styles.customInputBtn, { backgroundColor: colors.peach, opacity: customCommandInput.trim() ? 1 : 0.4 }]}
                onPress={() => {
                  const trimmed = customCommandInput.trim();
                  if (trimmed) { handleAddCommand(trimmed); setCustomCommandInput(""); }
                }}
                disabled={!customCommandInput.trim() || !!addingCommand}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {level3Count > 0 && (
        <View
          style={[
            styles.obedienceGate,
            { backgroundColor: colors.skyLight, borderColor: "#3B82F6" },
          ]}
        >
          <Text
            style={[
              styles.gateText,
              { color: "#1D4ED8", fontFamily: "Nunito_900Black" },
            ]}
          >
            {level3Count} of 7 commands Reliable
          </Text>
          <View style={[styles.gateBar, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.gateFill,
                {
                  width: `${Math.min(100, (level3Count / 7) * 100)}%`,
                  backgroundColor: "#3B82F6",
                },
              ]}
            />
          </View>
          {level3Count >= 7 && (
            <Text
              style={[
                styles.gateUnlocked,
                { color: "#3B82F6", fontFamily: "Nunito_700Bold" },
              ]}
            >
              Obedience Challenge unlocked!
            </Text>
          )}
        </View>
      )}

      {commands.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
          <Text
            style={[
              styles.emptyText,
              {
                color: colors.mutedForeground,
                fontFamily: "Nunito_400Regular",
              },
            ]}
          >
            No commands yet. Add some from the Training screen!
          </Text>
        </View>
      ) : (
        <View style={styles.commandsGrid}>
          {commands.map((cmd) => {
            const mastery = getCommandMastery(cmd);
            return (
              <CommandChip
                key={cmd.id}
                name={cmd.name}
                mastery={mastery}
                onPress={() => setSelectedCommandId(cmd.id)}
              />
            );
          })}
        </View>
      )}

      <View style={styles.masteryLegend}>
        {(["added", "learning", "reliable"] as MasteryLevel[]).map((m) => (
          <View key={m} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: MASTERY_COLORS[m].border },
              ]}
            />
            <Text
              style={[
                styles.legendText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Nunito_400Regular",
                },
              ]}
            >
              {MASTERY_LABELS[m]}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.achievementsNav,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => router.push("/achievements")}
        activeOpacity={0.8}
      >
        <View style={styles.achievementsNavLeft}>
          <Feather name="award" size={20} color={colors.lavender} />
          <View>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.dark,
                  fontFamily: "Nunito_900Black",
                  marginBottom: 2,
                },
              ]}
            >
              Achievements
            </Text>
            <Text
              style={[
                styles.achievementsNavSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Nunito_400Regular",
                },
              ]}
            >
              {unlockedAchievements.size} of {ACHIEVEMENT_TYPES.length} unlocked
            </Text>
          </View>
        </View>
        <Feather
          name="chevron-right"
          size={20}
          color={colors.mutedForeground}
        />
      </TouchableOpacity>
    </ScrollView>

    <Modal
      transparent
      animationType="fade"
      visible={selectedCommandId !== null}
      onRequestClose={() => setSelectedCommandId(null)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCommandId(null)}>
        <Pressable style={[styles.tooltipCard, { backgroundColor: colors.card, borderColor: ttMc.border }]} onPress={() => {}}>
          {selectedCmd && (
            <>
              <View style={styles.tooltipHeader}>
                <Text style={[styles.tooltipTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>
                  {selectedCmd.name}
                </Text>
                <View style={[styles.tooltipBadge, { backgroundColor: ttMc.bg, borderColor: ttMc.border }]}>
                  <Text style={[styles.tooltipBadgeText, { color: ttMc.text, fontFamily: "Nunito_700Bold" }]}>
                    {MASTERY_LABELS[ttMastery]}
                  </Text>
                </View>
              </View>

              <Text style={[styles.tooltipReps, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
                Total reps
              </Text>
              <Text style={[styles.tooltipRepsValue, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>
                {ttReps}
              </Text>

              {ttMastery !== "reliable" && (
                <>
                  <View style={styles.tooltipProgressRow}>
                    <Text style={[styles.tooltipProgressLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
                      {ttReps} / {ttNextTarget} → {ttNextLabel}
                    </Text>
                    <Text style={[styles.tooltipProgressPct, { color: ttMc.text, fontFamily: "Nunito_900Black" }]}>
                      {ttPct}%
                    </Text>
                  </View>
                  <View style={[styles.tooltipTrack, { backgroundColor: colors.muted }]}>
                    <View style={[styles.tooltipFill, { width: `${ttPct}%` as any, backgroundColor: ttMc.border }]} />
                  </View>
                </>
              )}

              {ttMastery === "reliable" && (
                <View style={[styles.tooltipReliableBanner, { backgroundColor: colors.mintLight }]}>
                  <Feather name="check-circle" size={16} color={colors.mint} />
                  <Text style={[styles.tooltipReliableText, { color: colors.mint, fontFamily: "Nunito_700Bold" }]}>
                    Fully mastered!
                  </Text>
                </View>
              )}

              <View style={styles.tooltipStats}>
                <View style={styles.tooltipStatItem}>
                  <Text style={[styles.tooltipStatValue, { color: colors.peach, fontFamily: "Nunito_900Black" }]}>
                    {selectedCmd.trainingSessionsCount}
                  </Text>
                  <Text style={[styles.tooltipStatLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
                    Training reps
                  </Text>
                </View>
                <View style={styles.tooltipStatItem}>
                  <Text style={[styles.tooltipStatValue, { color: colors.lavender, fontFamily: "Nunito_900Black" }]}>
                    {selectedCmd.qbSuccessesCount}
                  </Text>
                  <Text style={[styles.tooltipStatLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
                    Quick Bites hits
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.tooltipCloseBtn, { borderColor: colors.border }]}
                onPress={() => setSelectedCommandId(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tooltipCloseBtnText, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  avatarSection: { alignItems: "center", gap: 8, marginBottom: 28 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarEmoji: { fontSize: 48 },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 45,
  },
  avatarOverlayText: { color: "#fff", fontSize: 18 },
  dogName: { fontSize: 32 },
  dogBreed: { fontSize: 16 },
  levelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  levelText: { fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 28 },
  statLabel: { fontSize: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, marginBottom: 14 },
  editBtn: { fontSize: 15 },
  cueCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 24 },
  cueLabel: { fontSize: 14, marginBottom: 6 },
  cueInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    marginBottom: 4,
  },
  cueExamples: { fontSize: 12, marginBottom: 4 },
  cueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  cueRowLabel: { fontSize: 14, width: 70 },
  cueRowValue: { fontSize: 16 },
  obedienceGate: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  gateText: { fontSize: 14, marginBottom: 8 },
  gateBar: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  gateFill: { height: "100%", borderRadius: 4 },
  gateUnlocked: { fontSize: 13, marginTop: 4 },
  commandsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  commandChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  commandChipText: { fontSize: 14 },
  masteryLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11 },
  emptyCard: { borderRadius: 16, padding: 20, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  addCommandPanel: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  addCommandHint: { fontSize: 13, marginBottom: 10 },
  achievementsNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 28,
  },
  achievementsNavLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  achievementsNavSub: { fontSize: 13 },
  avatarWrapper: { position: "relative" },
  avatarCameraOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  addCommandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addCommandBtnText: { color: "#fff", fontSize: 13 },
  customInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  customInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  customInputBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  // Command tooltip modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
  tooltipCard: { width: "100%", borderRadius: 20, padding: 20, borderWidth: 1.5, gap: 4 },
  tooltipHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  tooltipTitle: { fontSize: 26 },
  tooltipBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  tooltipBadgeText: { fontSize: 12 },
  tooltipReps: { fontSize: 12, marginTop: 4 },
  tooltipRepsValue: { fontSize: 48, lineHeight: 52, marginBottom: 12 },
  tooltipProgressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  tooltipProgressLabel: { fontSize: 13 },
  tooltipProgressPct: { fontSize: 14 },
  tooltipTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 12 },
  tooltipFill: { height: "100%", borderRadius: 4 },
  tooltipReliableBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, marginBottom: 12 },
  tooltipReliableText: { fontSize: 14 },
  tooltipStats: { flexDirection: "row", gap: 16, marginTop: 8, marginBottom: 16 },
  tooltipStatItem: { alignItems: "center", gap: 2 },
  tooltipStatValue: { fontSize: 22 },
  tooltipStatLabel: { fontSize: 11 },
  tooltipCloseBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  tooltipCloseBtnText: { fontSize: 15 },
  dogCountLabel: { fontSize: 13, marginTop: 6 },
  addDogBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5, marginTop: 10 },
  addDogBtnText: { fontSize: 14 },
});
