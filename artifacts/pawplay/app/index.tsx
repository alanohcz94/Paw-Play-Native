import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

export default function WelcomeScreen() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const { onboardingComplete } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (onboardingComplete) {
          router.replace("/(tabs)");
        } else {
          router.replace("/onboarding");
        }
      }
    }
  }, [isAuthenticated, isLoading, onboardingComplete]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.appName, { color: colors.peach, fontFamily: "FredokaOne_400Regular" }]}>QuickMix</Text>
      </View>
    );
  }

  if (isAuthenticated) return null;

  return (
    <LinearGradient
      colors={["#FFF0EA", "#F7F3EF", "#E8F8F1"]}
      style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) }]}
    >
      <View style={styles.heroSection}>
        <View style={[styles.pawIconContainer, { backgroundColor: colors.peach }]}>
          <Text style={styles.pawEmoji}>🐾</Text>
        </View>
        <Text style={[styles.appName, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>QuickMix</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          Gamified dog training for the whole family
        </Text>
      </View>

      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={[styles.demoButton, { backgroundColor: colors.peach }]}
          onPress={() => router.push("/demo")}
          activeOpacity={0.85}
        >
          <Text style={[styles.demoButtonText, { fontFamily: "Nunito_900Black" }]}>Try a Quick Demo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.authRow} onPress={login} activeOpacity={0.7}>
          <Text style={[styles.authLabel, { color: colors.peach, fontFamily: "Nunito_700Bold", textDecorationLine: "underline" }]}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: "center",
    gap: 12,
    marginBottom: 48,
  },
  pawIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#FF8B6A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  pawEmoji: {
    fontSize: 48,
  },
  appName: {
    fontSize: 48,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
  },
  ctaSection: {
    width: "100%",
    gap: 16,
  },
  demoButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#FF8B6A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  demoButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    letterSpacing: 0.5,
  },
  authRow: {
    alignItems: "center",
  },
  authLabel: {
    fontSize: 15,
  },
});
