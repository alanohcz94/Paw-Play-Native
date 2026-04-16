import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

const FEATURES = [
  { icon: "zap" as const,      label: "Gamified training sessions" },
  { icon: "users" as const,    label: "Train as a family together" },
  { icon: "award" as const,    label: "Earn achievements & streaks" },
];

export default function WelcomeScreen() {
  const { isAuthenticated, isLoading, login, user } = useAuth();
  const { onboardingComplete, familyId, loadDogsFromApi, setFamilyId, setOnboardingComplete, setDogs } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.id) {
      const restore = async () => {
        if (onboardingComplete && familyId) {
          await loadDogsFromApi();
          router.replace("/(tabs)");
          return;
        }
        try {
          const token = await import("expo-secure-store").then((m) => m.getItemAsync("auth_session_token"));
          const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
          const res = await fetch(`${apiBase}/api/users/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const pawplayUser = await res.json();
            if (pawplayUser?.familyId) {
              setFamilyId(pawplayUser.familyId);
              setOnboardingComplete(true);
              const dogsRes = await fetch(`${apiBase}/api/family/${pawplayUser.familyId}/dogs`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (dogsRes.ok) {
                const { dogs: fetchedDogs } = await dogsRes.json();
                setDogs(fetchedDogs);
              }
              router.replace("/(tabs)");
              return;
            }
          }
        } catch {}
        router.replace("/onboarding");
      };
      restore();
    }
  }, [isAuthenticated, isLoading, user?.id]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.appName, { color: colors.peach, fontFamily: "FredokaOne_400Regular" }]}>QuickMix</Text>
      </View>
    );
  }

  if (isAuthenticated) return null;

  return (
    <LinearGradient
      colors={["#FFF0EA", "#F7F3EF", "#E8F8F1"]}
      style={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16),
        },
      ]}
    >
      {/* Hero */}
      <View style={styles.heroSection}>
        <View style={[styles.pawIconContainer, { backgroundColor: colors.peach }]}>
          <Text style={styles.pawEmoji}>🐾</Text>
        </View>
        <Text style={[styles.appName, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>
          QuickMix
        </Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
          Gamified dog training for the whole family
        </Text>
      </View>

      {/* Feature highlights */}
      <View style={[styles.featuresCard, { backgroundColor: "rgba(255,255,255,0.7)" }]}>
        {FEATURES.map((f, i) => (
          <View
            key={f.label}
            style={[
              styles.featureRow,
              i < FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
            ]}
          >
            <View style={[styles.featureIcon, { backgroundColor: colors.peachLight }]}>
              <Feather name={f.icon} size={16} color={colors.peach} />
            </View>
            <Text style={[styles.featureLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
              {f.label}
            </Text>
          </View>
        ))}
      </View>

      {/* CTAs */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.peach }]}
          onPress={() => router.push("/demo")}
          activeOpacity={0.85}
        >
          <Feather name="play-circle" size={20} color="#fff" />
          <Text style={[styles.primaryBtnText, { fontFamily: "Nunito_900Black" }]}>Try a Quick Demo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.peach }]}
          onPress={login}
          activeOpacity={0.8}
        >
          <Feather name="log-in" size={18} color={colors.peach} />
          <Text style={[styles.secondaryBtnText, { color: colors.peach, fontFamily: "Nunito_700Bold" }]}>
            Already have an account? Sign in
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 28,
  },
  heroSection: {
    alignItems: "center",
    gap: 10,
  },
  pawIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#FF8B6A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  pawEmoji: { fontSize: 48 },
  appName: { fontSize: 48, letterSpacing: 1 },
  tagline: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  featuresCard: {
    width: "100%",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: { fontSize: 14 },
  ctaSection: {
    width: "100%",
    gap: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: "#FF8B6A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: { color: "#fff", fontSize: 18 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  secondaryBtnText: { fontSize: 15 },
});
