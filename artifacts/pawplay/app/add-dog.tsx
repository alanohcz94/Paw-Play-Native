import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";
import { ALL_COMMANDS } from "@/utils/scoring";

export default function AddDogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { familyId, addDog, setCommands, setActiveDogId } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState<"dog" | "commands">("dog");
  const [dogName, setDogName] = useState("");
  const [dogAge, setDogAge] = useState("");
  const [selectedCommands, setSelectedCommands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const apiBase = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

  const toggleCommand = (cmd: string) => {
    setSelectedCommands((prev) =>
      prev.includes(cmd) ? prev.filter((c) => c !== cmd) : [...prev, cmd]
    );
  };

  const handleCreate = async () => {
    if (!user?.id || !familyId) return;
    setIsLoading(true);
    try {
      const { getItemAsync } = await import("expo-secure-store");
      const token = await getItemAsync("auth_session_token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

      const dogRes = await fetch(`${apiBase}/api/dogs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: dogName, familyId, age: dogAge ? parseFloat(dogAge) : undefined }),
      });
      if (!dogRes.ok) {
        Alert.alert("Error", "Could not create dog. Please try again.");
        setIsLoading(false);
        return;
      }
      const newDog = await dogRes.json();

      if (selectedCommands.length > 0) {
        await Promise.all(
          selectedCommands.map((name) =>
            fetch(`${apiBase}/api/dogs/${newDog.id}/commands`, {
              method: "POST",
              headers,
              body: JSON.stringify({ name }),
            })
          )
        );
      }

      const cmdsRes = await fetch(`${apiBase}/api/dogs/${newDog.id}/commands`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cmdsRes.ok) {
        const { commands } = await cmdsRes.json();
        setCommands(commands);
      }

      addDog(newDog);
      setActiveDogId(newDog.id);
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.dark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Add a New Dog</Text>
        <View style={{ width: 24 }} />
      </View>

      {step === "dog" && (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Tell us about your pup!</Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>Add another dog to your family</Text>

          <Text style={[styles.label, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Dog's name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.dark, fontFamily: "Nunito_400Regular" }]}
            value={dogName}
            onChangeText={setDogName}
            placeholder="e.g. Luna"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.label, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Dog's age</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.dark, fontFamily: "Nunito_400Regular" }]}
            value={dogAge}
            onChangeText={setDogAge}
            placeholder="e.g. 2.5"
            keyboardType="numeric"
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

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: colors.peach }]}
            onPress={handleCreate}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextButtonText, { color: "#fff", fontFamily: "Nunito_900Black" }]}>
              {isLoading ? "Creating..." : selectedCommands.length > 0 ? "Add Dog" : "Add Dog (No Commands)"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  headerTitle: { fontSize: 18 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 26, marginTop: 16, marginBottom: 8 },
  stepSubtitle: { fontSize: 15, marginBottom: 28, lineHeight: 22 },
  label: { fontSize: 15, marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 20 },
  nextButton: { paddingVertical: 18, borderRadius: 16, alignItems: "center", marginTop: 8, marginBottom: 24 },
  nextButtonText: { fontSize: 18 },
  commandsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  commandChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  commandChipText: { fontSize: 15 },
});
