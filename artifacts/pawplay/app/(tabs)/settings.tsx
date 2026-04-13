import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { familyId } = useApp();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24), paddingBottom: 100 + (Platform.OS === "web" ? 34 : insets.bottom) }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.header, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Settings</Text>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Notifications</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Feather name="bell" size={18} color={colors.mutedForeground} />
            <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Push Notifications</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: colors.muted, true: colors.peach }}
            thumbColor="#fff"
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Feather name="clock" size={18} color={colors.mutedForeground} />
            <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Daily Reminders</Text>
          </View>
          <Switch
            value={reminders}
            onValueChange={setReminders}
            trackColor={{ false: colors.muted, true: colors.peach }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {familyId && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Family</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="users" size={18} color={colors.mutedForeground} />
              <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Invite Code</Text>
            </View>
            <Text style={[styles.inviteCode, { color: colors.lavender, fontFamily: "Nunito_900Black" }]}>{familyId.slice(0, 6).toUpperCase()}</Text>
          </View>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Account</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Feather name="user" size={18} color={colors.mutedForeground} />
            <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>{user?.firstName ?? "User"}</Text>
          </View>
          <Text style={[styles.settingValue, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>{user?.email ?? ""}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.signOutRow} onPress={() => logout()} activeOpacity={0.7}>
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive, fontFamily: "Nunito_700Bold" }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>QuickMix v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { fontSize: 36, marginBottom: 24 },
  section: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 15, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  settingLabel: { fontSize: 16 },
  settingValue: { fontSize: 14 },
  divider: { height: 1, marginVertical: 14 },
  inviteCode: { fontSize: 18, letterSpacing: 2 },
  signOutRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  signOutText: { fontSize: 16 },
  version: { textAlign: "center", fontSize: 13, marginTop: 8 },
});
