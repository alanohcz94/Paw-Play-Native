import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform,
} from "react-native";
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
  const { setDog, setCommands, setOnboardingComplete, setFamilyId } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("dog");
  const [dogName, setDogName] = useState("");
  const [dogAge, setDogAge] = useState("");
  const [selectedCommands, setSelectedCommands] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  const toggleCommand = (cmd: string) => {
    setSelectedCommands((prev) =>
      prev.includes(cmd) ? prev.filter((c) => c !== cmd) : [...prev, cmd]
    );
  };

  const handleCreateFamily = async (userId: string) => {
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

        await fetch(`${apiBase}/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ displayName: user?.firstName || "Family Member", familyId: family.id }),
        });

        const dogRes = await fetch(`${apiBase}/api/dogs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: dogName, familyId: family.id, age: dogAge ? parseFloat(dogAge) : undefined }),
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
  };

  const handleComplete = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    await handleCreateFamily(user.id);
    setOnboardingComplete(true);
    setIsLoading(false);
    router.replace("/(tabs)");
  };

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

          <Text style={[styles.label, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Dog's age *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.dark, fontFamily: "Nunito_400Regular" }]}
            value={dogAge}
            onChangeText={setDogAge}
            placeholder="e.g. 2.5"
            keyboardType="numeric"
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: dogName && dogAge ? colors.peach : colors.muted }]}
            onPress={() => setStep("commands")}
            disabled={!dogName || !dogAge}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextButtonText, { color: dogName && dogAge ? "#fff" : colors.mutedForeground, fontFamily: "Nunito_900Black" }]}>Next</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === "commands" && (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>What does {dogName} know?</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>Select commands they already know</Text>

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
          <Text style={[styles.stepTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Invite your family</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>Train together and compete on the leaderboard</Text>

          <Text style={[styles.label, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Family member's email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.dark, fontFamily: "Nunito_400Regular" }]}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.peach }]} onPress={() => setStep("done")} activeOpacity={0.85}>
            <Text style={[styles.nextButtonText, { color: "#fff", fontFamily: "Nunito_900Black" }]}>{inviteEmail ? "Invite & Continue" : "Skip"}</Text>
          </TouchableOpacity>
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
              {dogName} is ready to start training. Let's play!
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
  celebrationContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  celebrationCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  celebrationEmoji: { fontSize: 56 },
});
