import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

export default function JoinFamilyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setFamilyId, setInviteCode } = useApp();
  const { user } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      setError("Please enter a 6-character invite code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { authedFetch } = await import("@/lib/authedFetch");
      const res = await authedFetch(`/api/family/join/${trimmed}`, { method: "POST" });
      if (!res.ok) {
        setError("Invalid invite code. Please check and try again.");
        return;
      }
      const family = await res.json();
      setFamilyId(family.id);
      setInviteCode(family.inviteCode);
      await authedFetch(`/api/users/${user?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: user?.firstName || "Family Member",
          familyId: family.id,
        }),
      });
      router.back();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [code, setFamilyId, setInviteCode, user?.id, user?.firstName]);

  const isReady = code.trim().length === 6;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={colors.dark} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: colors.lavender + "1A" }]}>
          <Feather name="users" size={36} color={colors.lavender} />
        </View>

        <Text style={[styles.title, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>
          Join a Family
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
          Enter the 6-character invite code shared by your family member.
        </Text>

        {/* Code input */}
        <TextInput
          style={[
            styles.codeInput,
            {
              backgroundColor: colors.card,
              borderColor: error ? colors.destructive : colors.border,
              color: colors.dark,
              fontFamily: "Nunito_900Black",
            },
          ]}
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase()); setError(""); }}
          placeholder="A3F2BC"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          maxLength={6}
          autoFocus
          editable={!loading}
          returnKeyType="done"
          onSubmitEditing={handleJoin}
        />

        {error ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.errorBanner,
              { backgroundColor: colors.destructive + "1A", borderColor: colors.destructive },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Nunito_700Bold" }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* Join button */}
        <TouchableOpacity
          style={[
            styles.joinBtn,
            {
              backgroundColor: isReady ? colors.lavender : colors.muted,
              opacity: loading ? 0.6 : 1,
            },
          ]}
          onPress={handleJoin}
          activeOpacity={0.85}
          disabled={loading || !isReady}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.joinBtnText, { fontFamily: "Nunito_900Black" }]}>
              Join Family
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Text style={[styles.cancelText, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  backBtn: {
    alignSelf: "flex-start",
    padding: 8,
    marginBottom: 32,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  codeInput: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    fontSize: 32,
    letterSpacing: 10,
    textAlign: "center",
    marginBottom: 16,
  },
  errorBanner: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 14, textAlign: "center" },
  joinBtn: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },
  joinBtnText: { color: "#fff", fontSize: 17 },
  cancelBtn: {
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
  },
  cancelText: { fontSize: 16 },
});
