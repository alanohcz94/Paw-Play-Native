import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

const FEATURES = [
  { icon: "zap" as const, label: "Gamified training sessions" },
  { icon: "users" as const, label: "Train with friends" },
  { icon: "award" as const, label: "Earn achievements & streaks" },
];

export default function HomeScreen() {
  const { isAuthenticated, isLoading, login, user, loginError, clearLoginError } = useAuth();
  const {
    setOnboardingComplete,
    setDogs,
    setCommands,
    setInviteCode,
  } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.id && !hasNavigated.current) {
      const restore = async () => {
        hasNavigated.current = true;
        try {
          const { authedFetch } = await import("@/lib/authedFetch");
          // Lazy-creates pawplay user row + invite code if missing
          const meRes = await authedFetch(`/api/users/me`);
          if (meRes.status === 401) return;
          if (meRes.ok) {
            const me = await meRes.json();
            if (me?.inviteCode) setInviteCode(me.inviteCode);
          }

          const dogsRes = await authedFetch(`/api/users/${user.id}/dogs`);
          if (dogsRes.status === 401) return;
          if (dogsRes.ok) {
            const { dogs: fetchedDogs } = await dogsRes.json();
            if (fetchedDogs && fetchedDogs.length > 0) {
              setDogs(fetchedDogs);
              setOnboardingComplete(true);
              const activeDogId = fetchedDogs[0].id;
              const cmdsRes = await authedFetch(`/api/dogs/${activeDogId}/commands`);
              if (cmdsRes.ok) {
                const { commands: cmds } = await cmdsRes.json();
                setCommands(cmds);
              }
              router.replace("/(tabs)");
              return;
            }
          }
        } catch (e) {
          console.warn("Auth restore failed, redirecting to onboarding:", e);
        }
        router.replace("/onboarding");
      };
      restore();
    }
  }, [isAuthenticated, isLoading, user?.id, setDogs, setOnboardingComplete, setCommands, setInviteCode]);

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
        <View
          style={[styles.pawIconContainer, { backgroundColor: colors.peach }]}
        >
          <Text style={styles.pawEmoji}>🐾</Text>
        </View>
        <Text
          style={[
            styles.appName,
            { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
          ]}
        >
          QuickMix
        </Text>
        <Text
          style={[
            styles.tagline,
            { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
          ]}
        >
          Gamified dog training, with your friends
        </Text>
      </View>

      {/* Feature highlights */}
      <View style={styles.featuresSection}>
        {FEATURES.map((f) => (
          <View
            key={f.label}
            style={[styles.featureRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.featureIconBox, { backgroundColor: colors.peachLight }]}>
              <Feather name={f.icon} size={18} color={colors.peach} />
            </View>
            <Text
              style={[
                styles.featureLabel,
                { color: colors.dark, fontFamily: "Nunito_700Bold" },
              ]}
            >
              {f.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Auth error */}
      {loginError && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.destructive + "1a", borderColor: colors.destructive },
          ]}
        >
          <Feather name="alert-circle" size={16} color={colors.destructive} />
          <Text
            style={[
              styles.errorText,
              { color: colors.destructive, fontFamily: "Nunito_700Bold" },
            ]}
            numberOfLines={2}
          >
            {loginError}
          </Text>
          <TouchableOpacity onPress={clearLoginError} hitSlop={8}>
            <Feather name="x" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      )}

      {/* CTA */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          onPress={login}
          style={[styles.loginButton, { backgroundColor: colors.peach }]}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.loginButtonText,
              { color: "#fff", fontFamily: "Nunito_900Black" },
            ]}
          >
            {isLoading ? "Loading…" : "Get Started"}
          </Text>
        </TouchableOpacity>
        <Text
          style={[
            styles.disclaimer,
            { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
          ]}
        >
          Sign in with your Replit account
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  heroSection: { alignItems: "center", marginTop: 28, gap: 8 },
  pawIconContainer: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  pawEmoji: { fontSize: 44 },
  appName: { fontSize: 44 },
  tagline: { fontSize: 15, textAlign: "center", paddingHorizontal: 12 },
  featuresSection: { gap: 10, marginVertical: 16 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  featureIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 14, flex: 1 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  errorText: { fontSize: 13, flex: 1 },
  ctaSection: { gap: 8, marginBottom: 12 },
  loginButton: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  loginButtonText: { fontSize: 18 },
  disclaimer: { textAlign: "center", fontSize: 12 },
});
