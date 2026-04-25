import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export default function GamesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { commands } = useApp();

  const level3Count = useMemo(() => commands.filter((c) => c.level >= 3).length, [commands]);
  const obedienceUnlocked = level3Count >= 7;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
            paddingBottom: 100 + (Platform.OS === "web" ? 34 : insets.bottom),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.header,
            { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
          ]}
        >
          Games
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
          ]}
        >
          Choose your training style
        </Text>

        <TouchableOpacity
          style={[
            styles.modeCard,
            {
              backgroundColor: colors.peachLight,
              borderColor: colors.peachMid,
            },
          ]}
          onPress={() => router.push("/challenge-setup")}
          activeOpacity={0.85}
        >
          <View style={styles.modeRow}>
            <View style={[styles.modeIcon, { backgroundColor: colors.peach }]}>
              <Feather name="zap" size={22} color="#fff" />
            </View>
            <View style={styles.modeInfo}>
              <Text
                style={[
                  styles.modeTitle,
                  { color: colors.dark, fontFamily: "Nunito_900Black" },
                ]}
              >
                Quick Bites
              </Text>
              <Text
                style={[
                  styles.modeDesc,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Nunito_400Regular",
                  },
                ]}
              >
                Random sequence · 2–5 min
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={22}
              color={colors.mutedForeground}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeCard,
            { backgroundColor: colors.mintLight, borderColor: colors.mintMid },
          ]}
          onPress={() => router.push("/training-config")}
          activeOpacity={0.85}
        >
          <View style={styles.modeRow}>
            <View style={[styles.modeIcon, { backgroundColor: colors.mint }]}>
              <Feather name="book-open" size={22} color="#fff" />
            </View>
            <View style={styles.modeInfo}>
              <Text
                style={[
                  styles.modeTitle,
                  { color: colors.dark, fontFamily: "Nunito_900Black" },
                ]}
              >
                Training
              </Text>
              <Text
                style={[
                  styles.modeDesc,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Nunito_400Regular",
                  },
                ]}
              >
                Learn + practice commands
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={22}
              color={colors.mutedForeground}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeCard,
            {
              backgroundColor: colors.lemonLight,
              borderColor: obedienceUnlocked ? colors.lemon : colors.border,
              opacity: obedienceUnlocked ? 1 : 0.85,
            },
          ]}
          onPress={() => {
            if (!obedienceUnlocked) return;
            router.push("/blitz-setup");
          }}
          activeOpacity={obedienceUnlocked ? 0.85 : 1}
          disabled={!obedienceUnlocked}
        >
          <View style={styles.modeRow}>
            <View
              style={[
                styles.modeIcon,
                {
                  backgroundColor: obedienceUnlocked
                    ? colors.lemon
                    : colors.muted,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="trophy-outline"
                size={22}
                color={obedienceUnlocked ? colors.dark : colors.mutedForeground}
              />
            </View>
            <View style={styles.modeInfo}>
              <View style={styles.modeHeaderRow}>
                <Text
                  style={[
                    styles.modeTitle,
                    { color: colors.dark, fontFamily: "Nunito_900Black" },
                  ]}
                >
                  Blitz
                </Text>
                {!obedienceUnlocked && (
                  <View
                    style={[styles.newBadge, { backgroundColor: colors.lemon }]}
                  >
                    <Text
                      style={[
                        styles.newBadgeText,
                        { fontFamily: "Nunito_900Black" },
                      ]}
                    >
                      LOCKED
                    </Text>
                  </View>
                )}
                {obedienceUnlocked && (
                  <View
                    style={[styles.newBadge, { backgroundColor: colors.mint }]}
                  >
                    <Text
                      style={[
                        styles.newBadgeText,
                        { fontFamily: "Nunito_900Black", color: "#fff" },
                      ]}
                    >
                      NEW
                    </Text>
                  </View>
                )}
              </View>
              {obedienceUnlocked ? (
                <Text
                  style={[
                    styles.modeDesc,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Nunito_400Regular",
                    },
                  ]}
                >
                  All reliable commands tested
                </Text>
              ) : (
                <View style={styles.progressSection}>
                  <Text
                    style={[
                      styles.progressLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Nunito_700Bold",
                      },
                    ]}
                  >
                    {level3Count} of 7 commands Reliable
                  </Text>
                  <View
                    style={[
                      styles.progressBar,
                      { backgroundColor: colors.muted },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(level3Count / 7) * 100}%`,
                          backgroundColor: colors.lemon,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </View>
            {obedienceUnlocked ? (
              <Feather
                name="chevron-right"
                size={22}
                color={colors.mutedForeground}
              />
            ) : (
              <Feather name="lock" size={20} color={colors.mutedForeground} />
            )}
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { fontSize: 36, marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 28 },
  modeCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  modeIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  modeInfo: { flex: 1, gap: 4 },
  modeHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modeTitle: { fontSize: 17 },
  modeDesc: { fontSize: 14 },
  progressSection: { gap: 6 },
  progressLabel: { fontSize: 13 },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  newBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  newBadgeText: { fontSize: 11, color: "#2D2D2D" },
});
