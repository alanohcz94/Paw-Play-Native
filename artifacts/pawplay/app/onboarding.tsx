import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";
import { ALL_COMMANDS } from "@/utils/scoring";

const STEPS = ["dog", "commands", "family", "done"] as const;
type Step = typeof STEPS[number];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setDog, setCommands, setOnboardingComplete, setFamilyId, setInviteCode } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("dog");
  const [dogName, setDogName] = useState("");
  const [selectedCommands, setSelectedCommands] = useState<string[]>([]);

  // Family step state
  const [familyTab, setFamilyTab] = useState<"join" | "skip">("skip");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  const toggleCommand = useCallback((cmd: string) => {
    setSelectedCommands((prev) =>
      prev.includes(cmd) ? prev.filter((c) => c !== cmd) : [...prev, cmd]
    );
  }, []);

  const handleJoinFamily = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setJoinError("Please enter an invite code."); return; }
    setJoinError("");
    setJoinLoading(true);
    try {
      const token = await import("expo-secure-store").then((m) => m.getItemAsync("auth_session_token"));
      const res = await fetch(`${apiBase}/api/family/join/${code}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setJoinError("Invalid invite code. Please check and try again.");
        setJoinLoading(false);
        return;
      }
      const family = await res.json();
      setFamilyId(family.id);
      setInviteCode(family.inviteCode);

      await fetch(`${apiBase}/api/users/${user?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: user?.firstName || "Family Member", familyId: family.id }),
      });

      setIsJoining(true);
      setStep("done");
    } catch {
      setJoinError("Something went wrong. Please try again.");
    } finally {
      setJoinLoading(false);
    }
  }, [joinCode, apiBase, setFamilyId, setInviteCode, user?.id]);

  const handleCreateFamily = useCallback(async (userId: string) => {
    try {
      const token = await import("expo-secure-store").then((m) => m.getItemAsync("auth_session_token"));
      const res = await fetch(`${apiBase}/api/family`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const family = await res.json();
        setFamilyId(family.id);
        setInviteCode(family.inviteCode);

        await fetch(`${apiBase}/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ displayName: user?.firstName || "Family Member", familyId: family.id }),
        });

        const dogRes = await fetch(`${apiBase}/api/dogs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: dogName, familyId: family.id }),
        });
        if (dogRes.ok) {
          const dog = await dogRes.json();
          setDog(dog);

          const cmdPromises = selectedCommands.map((name) =>
            fetch(`${apiBase}/api/dogs/${dog.id}/commands`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ name }),
            })
          );
          await Promise.all(cmdPromises);

          const cmdsRes = await fetch(`${apiBase}/api/dogs/${dog.id}/commands`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (cmdsRes.ok) {
            const { commands } = await cmdsRes.json();
            setCommands(commands);
          }
        }
      }
    } catch (err) {
      console.error("Onboarding error:", err);
    }
  }, [apiBase, dogName, selectedCommands, setDog, setCommands, setFamilyId, setInviteCode, user?.firstName]);

  const handleComplete = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    if (!isJoining) {
      // New family creator: create family + dog + commands
      await handleCreateFamily(user.id);
    }
    setOnboardingComplete(true);
    setIsLoading(false);
    router.replace("/(tabs)");
  }, [user?.id, isJoining, handleCreateFamily, setOnboardingComplete]);

  const progress = (STEPS.indexOf(step) + 1) / STEPS.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) }]}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.lavender }]} />
      </View>

      {step === "dog" && (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Tell us about your pup!</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>We'll personalise training just for them</Text>

          <Text style={[styles.label, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Dog's name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.dark, fontFamily: "Nunito_400Regular" }]}
            value={dogName}
            onChangeText={setDogName}
            placeholder="e.g. Max"
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: dogName ? colors.peach : colors.muted }]}
            onPress={() => setStep("commands")}
            disabled={!dogName}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextButtonText, { color: dogName ? "#fff" : colors.mutedForeground, fontFamily: "Nunito_900Black" }]}>Next</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === "commands" && (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>What does {dogName} know?</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>Select commands they already know</Text>

          <View style={[styles.infoPanel, { backgroundColor: colors.lavLight, borderLeftColor: colors.lavender }]}>
            <Feather name="info" size={15} color={colors.lavender} />
            <Text style={[styles.infoPanelText, { color: colors.dark, fontFamily: "Nunito_400Regular" }]}>
              You can always add or edit commands later from your dog's Profile page.
            </Text>
          </View>

          <View style={styles.commandsGrid}>
            {ALL_COMMANDS.map((cmd) => {
              const selected = selectedCommands.includes(cmd);
              return (
                <TouchableOpacity
                  key={cmd}
                  style={[styles.commandChip, { backgroundColor: selected ? colors.mintLight : colors.card, borderColor: selected ? colors.mint : colors.border, borderWidth: 2 }]}
                  onPress={() => toggleCommand(cmd)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.commandChipText, { color: selected ? colors.mint : colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>{cmd}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.peach }]} onPress={() => setStep("family")} activeOpacity={0.85}>
            <Text style={[styles.nextButtonText, { color: "#fff", fontFamily: "Nunito_900Black" }]}>{selectedCommands.length > 0 ? "Next" : "Skip"}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === "family" && (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Join your family</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
            Train together and share your dog's progress. Each person keeps their own points!
          </Text>

          {/* Tab toggle */}
          <View style={[styles.tabRow, { backgroundColor: colors.muted, borderRadius: 14 }]}>
            <TouchableOpacity
              style={[styles.tab, familyTab === "join" && { backgroundColor: colors.card, borderRadius: 12 }]}
              onPress={() => { setFamilyTab("join"); setJoinError(""); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: familyTab === "join" ? colors.dark : colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>I have a code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, familyTab === "skip" && { backgroundColor: colors.card, borderRadius: 12 }]}
              onPress={() => setFamilyTab("skip")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: familyTab === "skip" ? colors.dark : colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Skip for now</Text>
            </TouchableOpacity>
          </View>

          {familyTab === "join" && (
            <View style={styles.joinSection}>
              <Text style={[styles.label, { color: colors.dark, fontFamily: "Nunito_700Bold", marginTop: 20 }]}>Enter invite code</Text>
              <TextInput
                style={[styles.codeInput, { backgroundColor: colors.card, borderColor: joinError ? colors.destructive : colors.border, color: colors.dark, fontFamily: "Nunito_900Black", letterSpacing: 6 }]}
                value={joinCode}
                onChangeText={(t) => { setJoinCode(t.toUpperCase()); setJoinError(""); }}
                placeholder="A3F2BC"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                maxLength={6}
              />
              {joinError ? (
                <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Nunito_400Regular" }]}>{joinError}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: joinCode.trim().length === 6 ? colors.lavender : colors.muted, marginTop: 8 }]}
                onPress={handleJoinFamily}
                disabled={joinLoading || joinCode.trim().length < 4}
                activeOpacity={0.85}
              >
                {joinLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.nextButtonText, { color: joinCode.trim().length >= 4 ? "#fff" : colors.mutedForeground, fontFamily: "Nunito_900Black" }]}>Join Family</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {familyTab === "skip" && (
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: colors.peach, marginTop: 24 }]}
              onPress={() => setStep("done")}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextButtonText, { color: "#fff", fontFamily: "Nunito_900Black" }]}>Continue</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {step === "done" && (
        <View style={styles.stepContent}>
          <View style={styles.celebrationContainer}>
            <View style={[styles.celebrationCircle, { backgroundColor: colors.peachLight }]}>
              <Text style={styles.celebrationEmoji}>🐾</Text>
            </View>
            <Text style={[styles.stepTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular", textAlign: "center" }]}>You're all set!</Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular", textAlign: "center" }]}>
              {isJoining
                ? "You've joined the family! Your shared dogs are ready to train."
                : `${dogName} is ready to start training. Let's play!`}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: colors.peach }]}
            onPress={handleComplete}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextButtonText, { color: "#fff", fontFamily: "Nunito_900Black" }]}>{isLoading ? "Setting up..." : "Go to Dashboard"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  progressBar: { height: 6, backgroundColor: "#EDE6DE", borderRadius: 3, marginVertical: 16 },
  progressFill: { height: "100%", borderRadius: 3 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 30, marginTop: 24, marginBottom: 8 },
  stepSubtitle: { fontSize: 16, marginBottom: 32, lineHeight: 24 },
  label: { fontSize: 15, marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 20 },
  nextButton: { paddingVertical: 18, borderRadius: 16, alignItems: "center", marginTop: 8, marginBottom: 24 },
  nextButtonText: { fontSize: 18 },
  commandsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  commandChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  commandChipText: { fontSize: 15 },
  infoPanel: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderLeftWidth: 3, borderRadius: 10, padding: 12, marginBottom: 16 },
  infoPanelText: { flex: 1, fontSize: 13, lineHeight: 20 },
  celebrationContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  celebrationCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  celebrationEmoji: { fontSize: 56 },
  // Family step
  tabRow: { flexDirection: "row", padding: 4, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabText: { fontSize: 15 },
  joinSection: {},
  codeInput: { borderWidth: 1.5, borderRadius: 12, padding: 16, fontSize: 24, marginBottom: 4, textAlign: "center" },
  errorText: { fontSize: 13, marginBottom: 8, marginTop: 2 },
});
