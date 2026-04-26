import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export default function BlitzSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { dog, commands } = useApp();
  const [duration, setDuration] = useState<90 | 120>(90);

  const markerCue = dog?.markerCue || "Yes";
  const dogName = dog?.name || "your dog";
  const hasEnoughCommands = commands.length >= 3;

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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={colors.dark} />
        </TouchableOpacity>

        <Text
          style={[styles.header, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}
        >
          Blitz ⚡
        </Text>
        <Text
          style={[
            styles.subheader,
            { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
          ]}
        >
          {`Keep ${dogName} sharp — hold when it counts`}
        </Text>

        <View
          style={[
            styles.infoBox,
            { backgroundColor: colors.mintLight, borderLeftColor: colors.mint },
          ]}
        >
          <Text
            style={[styles.infoText, { color: colors.dark, fontFamily: "Nunito_400Regular" }]}
          >
            {"Commands appear one by one. Tap "}
            <Text style={{ fontFamily: "Nunito_900Black" }}>{markerCue}</Text>
            {` the moment ${dogName} complies. Sometimes a hold will follow — watch the button. ${dogName} must not move until it turns green.`}
          </Text>
        </View>

        <Text
          style={[styles.sectionLabel, { color: colors.dark, fontFamily: "Nunito_900Black" }]}
        >
          Duration
        </Text>
        <View style={styles.durationRow}>
          {([90, 120] as const).map((d) => (
            <TouchableOpacity
              key={d}
              style={[
                styles.durationPill,
                duration === d
                  ? { backgroundColor: colors.mint }
                  : {
                      backgroundColor: "transparent",
                      borderWidth: 1.5,
                      borderColor: colors.mint,
                    },
              ]}
              onPress={() => setDuration(d)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.durationText,
                  {
                    fontFamily: "Nunito_900Black",
                    color: duration === d ? "#fff" : colors.mint,
                  },
                ]}
              >
                {d} sec
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!hasEnoughCommands ? (
          <View
            style={[
              styles.lockedBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="lock" size={20} color={colors.mutedForeground} />
            <Text
              style={[
                styles.lockedText,
                { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
              ]}
            >
              {`Add at least 3 commands to ${dogName}'s library`}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: colors.mint }]}
            onPress={() =>
              router.push({
                pathname: "/blitz-active",
                params: { duration: String(duration) },
              })
            }
            activeOpacity={0.85}
          >
            <Text style={[styles.startText, { fontFamily: "Nunito_900Black" }]}>
              Start Blitz ⚡
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { marginBottom: 16, alignSelf: "flex-start" },
  header: { fontSize: 28, marginBottom: 4 },
  subheader: { fontSize: 15, marginBottom: 24 },
  infoBox: { borderLeftWidth: 4, borderRadius: 12, padding: 16, marginBottom: 32 },
  infoText: { fontSize: 14, lineHeight: 22 },
  sectionLabel: { fontSize: 15, marginBottom: 12 },
  durationRow: { flexDirection: "row", gap: 12, marginBottom: 36 },
  durationPill: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 14,
  },
  durationText: { fontSize: 16 },
  lockedBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lockedText: { fontSize: 14, flex: 1 },
  startBtn: {
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: "center",
  },
  startText: { color: "#fff", fontSize: 18 },
});
