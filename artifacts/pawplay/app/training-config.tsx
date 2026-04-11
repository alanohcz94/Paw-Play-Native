import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ALL_COMMANDS } from "@/utils/scoring";

const REWARD_TYPES = ["Treats", "Play", "Praise"] as const;
type RewardType = typeof REWARD_TYPES[number];

export default function TrainingConfigScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { commands } = useApp();
  const [selectedCommand, setSelectedCommand] = useState<string>(commands[0]?.name ?? ALL_COMMANDS[0]);
  const [rewardType, setRewardType] = useState<RewardType>("Treats");
  const [variableSchedule, setVariableSchedule] = useState(false);
  const [reps, setReps] = useState(5);

  const availableCommands = commands.length > 0 ? commands.map((c) => c.name) : ALL_COMMANDS;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.dark} />
        </TouchableOpacity>
        <Text style={[styles.header, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Training</Text>
        <Text style={[styles.subheader, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Configure your session</Text>

        <Text style={[styles.sectionLabel, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Command</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.commandScroll}>
          {availableCommands.map((cmd) => (
            <TouchableOpacity
              key={cmd}
              style={[styles.commandChip, { backgroundColor: selectedCommand === cmd ? colors.peachLight : colors.card, borderColor: selectedCommand === cmd ? colors.peach : colors.border, borderWidth: 2 }]}
              onPress={() => setSelectedCommand(cmd)}
              activeOpacity={0.8}
            >
              <Text style={[styles.commandChipText, { color: selectedCommand === cmd ? colors.peach : colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>{cmd}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.sectionLabel, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Reward Type</Text>
        <View style={styles.rewardRow}>
          {REWARD_TYPES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rewardChip, { backgroundColor: rewardType === r ? colors.mintLight : colors.card, borderColor: rewardType === r ? colors.mint : colors.border, borderWidth: 2 }]}
              onPress={() => setRewardType(r)}
              activeOpacity={0.8}
            >
              <Text style={[styles.rewardText, { color: rewardType === r ? colors.mint : colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.scheduleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.scheduleInfo}>
            <Text style={[styles.scheduleLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Variable Reward Schedule</Text>
          </View>
          <Switch
            value={variableSchedule}
            onValueChange={setVariableSchedule}
            trackColor={{ false: colors.muted, true: colors.mint }}
            thumbColor="#fff"
          />
        </View>
        <Text style={[styles.scheduleTooltip, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
          Keeps your dog guessing — builds stronger habits over time. Best for dogs with a solid foundation.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Repetitions</Text>
        <View style={[styles.repCounter, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setReps((r) => Math.max(3, r - 1))}
            style={[styles.repBtn, { backgroundColor: colors.background }]}
            activeOpacity={0.7}
          >
            <Feather name="minus" size={20} color={colors.dark} />
          </TouchableOpacity>
          <Text style={[styles.repValue, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>{reps}</Text>
          <TouchableOpacity
            onPress={() => setReps((r) => Math.min(10, r + 1))}
            style={[styles.repBtn, { backgroundColor: colors.background }]}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={20} color={colors.dark} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: colors.peach }]}
          onPress={() => router.push({ pathname: "/training-active", params: { command: selectedCommand, rewardType, variableSchedule: variableSchedule ? "1" : "0", reps: String(reps) } })}
          activeOpacity={0.85}
        >
          <Text style={[styles.startBtnText, { fontFamily: "Nunito_900Black" }]}>Start Training</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24 },
  backBtn: { marginBottom: 12, alignSelf: "flex-start" },
  header: { fontSize: 36, marginBottom: 4 },
  subheader: { fontSize: 16, marginBottom: 24 },
  sectionLabel: { fontSize: 15, marginBottom: 12 },
  commandScroll: { marginBottom: 24 },
  commandChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginRight: 8 },
  commandChipText: { fontSize: 15 },
  rewardRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  rewardChip: { flex: 1, alignItems: "center", borderRadius: 14, paddingVertical: 12 },
  rewardText: { fontSize: 15 },
  scheduleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 8 },
  scheduleInfo: { flex: 1, marginRight: 12 },
  scheduleLabel: { fontSize: 15 },
  scheduleTooltip: { fontSize: 13, lineHeight: 20, marginBottom: 24 },
  repCounter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 32 },
  repBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  repValue: { fontSize: 32, minWidth: 48, textAlign: "center" },
  startBtn: { paddingVertical: 18, borderRadius: 16, alignItems: "center", shadowColor: "#FF8B6A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  startBtnText: { color: "#fff", fontSize: 18 },
});
