import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Modal,
  Pressable,
  Share,
  Clipboard,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = ["00", "15", "30", "45"];
const PERIODS = ["AM", "PM"] as const;

function to24h(h: number, m: string, period: "AM" | "PM"): string {
  let hour = h;
  if (period === "AM" && h === 12) hour = 0;
  if (period === "PM" && h !== 12) hour = h + 12;
  return `${String(hour).padStart(2, "0")}:${m}`;
}

function from24h(time: string): { h: number; m: string; period: "AM" | "PM" } {
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h = h - 12;
  return { h, m: mStr, period };
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    familyId,
    inviteCode,
    setInviteCode,
    reminderTime,
    setReminderTime,
    soundEnabled,
    setSoundEnabled,
    resetState,
  } = useApp();
  const { user, logout } = useAuth();

  const handleLogout = useCallback(async () => {
    resetState();
    await logout();
    router.replace("/home");
  }, [resetState, logout]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = useCallback(async () => {
    if (!user) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { authedFetch } = await import("@/lib/authedFetch");
      const res = await authedFetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.warn(
          "Delete account failed:",
          res.status,
          await res.text().catch(() => ""),
        );
        setDeleteError("Couldn't delete your account. Please try again.");
        return;
      }
      setShowDeleteModal(false);
      resetState();
      try {
        await logout();
      } catch (err) {
        console.warn("Logout after delete failed:", err);
      }
      router.replace("/home");
    } catch (err) {
      console.error("Delete account error:", err);
      setDeleteError("Couldn't delete your account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [user, resetState, logout]);

  useEffect(() => {
    if (!showDeleteModal) setDeleteError(null);
  }, [showDeleteModal]);

  const [fetchedCode, setFetchedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const displayCode = inviteCode ?? fetchedCode;

  useEffect(() => {
    if (!familyId || inviteCode) return;
    const loadCode = async () => {
      try {
        const { authedFetch } = await import("@/lib/authedFetch");
        const res = await authedFetch(`/api/family/${familyId}`);
        if (res.ok) {
          const fam = await res.json();
          setFetchedCode(fam.inviteCode);
          setInviteCode(fam.inviteCode);
        }
      } catch (e) {
        console.warn("Failed to load invite code:", e);
      }
    };
    loadCode();
  }, [familyId, inviteCode]);

  const handleCopyCode = useCallback(() => {
    if (!displayCode) return;
    Clipboard.setString(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [displayCode]);

  const handleShareInvite = useCallback(() => {
    if (!displayCode) return;
    Share.share({
      message: `Join my family on QuickMix! Use invite code: ${displayCode}\n\nDownload QuickMix, go through onboarding, tap "I have a code" and enter the code above to train our dog together.`,
      title: "QuickMix Family Invite",
    });
  }, [displayCode]);

  const [notifications, setNotifications] = useState(false);
  const [remindersOn, setRemindersOn] = useState(reminderTime !== null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const parsed = reminderTime
    ? from24h(reminderTime)
    : { h: 7, m: "00", period: "AM" as const };
  const [pickerH, setPickerH] = useState(parsed.h);
  const [pickerM, setPickerM] = useState(parsed.m);
  const [pickerP, setPickerP] = useState<"AM" | "PM">(parsed.period);

  const reminderDisplay = useMemo(
    () =>
      reminderTime
        ? (() => {
            const p = from24h(reminderTime);
            return `${p.h}:${p.m} ${p.period}`;
          })()
        : "Not set",
    [reminderTime],
  );

  const handleReminderToggle = useCallback(
    (val: boolean) => {
      setRemindersOn(val);
      if (!val) {
        setReminderTime(null);
      } else {
        setShowTimePicker(true);
      }
    },
    [setReminderTime],
  );

  const confirmTime = useCallback(() => {
    setReminderTime(to24h(pickerH, pickerM, pickerP));
    setShowTimePicker(false);
  }, [pickerH, pickerM, pickerP, setReminderTime]);

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
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
          Settings
        </Text>

        {/* Notifications */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.dark, fontFamily: "Nunito_900Black" },
            ]}
          >
            Notifications
          </Text>
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingInfo}>
              <Feather name="bell" size={18} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.settingLabel,
                  { color: colors.dark, fontFamily: "Nunito_700Bold" },
                ]}
              >
                Push Notifications
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: colors.muted, true: colors.peach }}
              thumbColor="#fff"
              disabled
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingInfo}>
              <Feather name="clock" size={18} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.settingLabel,
                  { color: colors.dark, fontFamily: "Nunito_700Bold" },
                ]}
              >
                Daily Reminder
              </Text>
            </View>
            <Switch
              value={remindersOn}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.muted, true: colors.peach }}
              thumbColor="#fff"
              disabled
            />
          </View>
          {remindersOn && (
            <TouchableOpacity
              style={[styles.timeRow, { borderColor: colors.border }]}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.75}
            >
              <Feather name="sun" size={16} color={colors.peach} />
              <Text
                style={[
                  styles.timeLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Nunito_400Regular",
                  },
                ]}
              >
                Reminder time
              </Text>
              <Text
                style={[
                  styles.timeValue,
                  { color: colors.dark, fontFamily: "Nunito_900Black" },
                ]}
              >
                {reminderDisplay}
              </Text>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Sound */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.dark, fontFamily: "Nunito_900Black" },
            ]}
          >
            Sound
          </Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather
                name={soundEnabled ? "volume-2" : "volume-x"}
                size={18}
                color={colors.mutedForeground}
              />
              <View>
                <Text
                  style={[
                    styles.settingLabel,
                    { color: colors.dark, fontFamily: "Nunito_700Bold" },
                  ]}
                >
                  Sound Effects
                </Text>
                <Text
                  style={[
                    styles.settingSubLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Nunito_400Regular",
                    },
                  ]}
                >
                  {soundEnabled
                    ? "Ding on comply, fanfare on complete"
                    : "Muted"}
                </Text>
              </View>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: colors.muted, true: colors.peach }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Family */}
        {familyId && (
          <View
            style={[
              styles.section,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.dark, fontFamily: "Nunito_900Black" },
              ]}
            >
              Family
            </Text>

            {/* Invite code display */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather
                  name="users"
                  size={18}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.settingLabel,
                    { color: colors.dark, fontFamily: "Nunito_700Bold" },
                  ]}
                >
                  Invite Code
                </Text>
              </View>
              <Text
                style={[
                  styles.inviteCode,
                  { color: colors.lavender, fontFamily: "Nunito_900Black" },
                ]}
              >
                {displayCode ?? "..."}
              </Text>
            </View>

            {displayCode && (
              <>
                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />

                {/* Copy code */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Feather
                      name="copy"
                      size={18}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.settingLabel,
                        { color: colors.dark, fontFamily: "Nunito_700Bold" },
                      ]}
                    >
                      Copy Code
                    </Text>
                  </View>
                  {copied ? (
                    <Text
                      style={[
                        styles.settingValue,
                        { color: colors.mint, fontFamily: "Nunito_700Bold" },
                      ]}
                    >
                      Copied!
                    </Text>
                  ) : (
                    <Feather
                      name="chevron-right"
                      size={16}
                      color={colors.mutedForeground}
                    />
                  )}
                </TouchableOpacity>

                <View
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />

                {/* Share invite */}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={handleShareInvite}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingInfo}>
                    <Feather
                      name="share-2"
                      size={18}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.settingLabel,
                        { color: colors.dark, fontFamily: "Nunito_700Bold" },
                      ]}
                    >
                      Share Invite
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Account */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.dark, fontFamily: "Nunito_900Black" },
            ]}
          >
            Account
          </Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="user" size={18} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.settingLabel,
                  { color: colors.dark, fontFamily: "Nunito_700Bold" },
                ]}
              >
                {user?.firstName ?? "User"}
              </Text>
            </View>
            <Text
              style={[
                styles.settingValue,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Nunito_400Regular",
                },
              ]}
            >
              {user?.email ?? ""}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.signOutRow}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text
              style={[
                styles.signOutText,
                { color: colors.destructive, fontFamily: "Nunito_700Bold" },
              ]}
            >
              Sign Out
            </Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.signOutRow}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={18} color={colors.destructive} />
            <Text
              style={[
                styles.signOutText,
                { color: colors.destructive, fontFamily: "Nunito_700Bold" },
              ]}
            >
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={[
            styles.version,
            { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" },
          ]}
        >
          QuickMix v1.0.0
        </Text>
      </ScrollView>

      {/* Time picker modal */}
      <Modal
        transparent
        animationType="slide"
        visible={showTimePicker}
        onRequestClose={() => setShowTimePicker(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setShowTimePicker(false)}
        >
          <Pressable
            style={[styles.pickerSheet, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <Text
              style={[
                styles.pickerTitle,
                { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
              ]}
            >
              Set Reminder Time
            </Text>

            {/* Hour row */}
            <Text
              style={[
                styles.pickerSectionLabel,
                { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
              ]}
            >
              Hour
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {HOURS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor:
                        pickerH === h ? colors.peach : colors.muted,
                    },
                  ]}
                  onPress={() => setPickerH(h)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      {
                        color: pickerH === h ? "#fff" : colors.dark,
                        fontFamily: "Nunito_700Bold",
                      },
                    ]}
                  >
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Minute row */}
            <Text
              style={[
                styles.pickerSectionLabel,
                { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
              ]}
            >
              Minute
            </Text>
            <View style={styles.chipRow}>
              {MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor:
                        pickerM === m ? colors.peach : colors.muted,
                    },
                  ]}
                  onPress={() => setPickerM(m)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      {
                        color: pickerM === m ? "#fff" : colors.dark,
                        fontFamily: "Nunito_700Bold",
                      },
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* AM / PM */}
            <Text
              style={[
                styles.pickerSectionLabel,
                { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" },
              ]}
            >
              AM / PM
            </Text>
            <View style={styles.chipRow}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor:
                        pickerP === p ? colors.peach : colors.muted,
                      minWidth: 60,
                    },
                  ]}
                  onPress={() => setPickerP(p)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      {
                        color: pickerP === p ? "#fff" : colors.dark,
                        fontFamily: "Nunito_700Bold",
                      },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview */}
            <Text
              style={[
                styles.previewTime,
                { color: colors.peach, fontFamily: "FredokaOne_400Regular" },
              ]}
            >
              {pickerH}:{pickerM} {pickerP}
            </Text>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.peach }]}
              onPress={confirmTime}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.confirmBtnText,
                  { fontFamily: "Nunito_900Black" },
                ]}
              >
                Set Reminder
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Delete account confirmation modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => !isDeleting && setShowDeleteModal(false)}
        >
          <Pressable
            style={[styles.deleteSheet, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={styles.deleteIconWrap}>
              <Feather name="trash-2" size={32} color={colors.destructive} />
            </View>
            <Text
              style={[
                styles.deleteTitle,
                { color: colors.dark, fontFamily: "FredokaOne_400Regular" },
              ]}
            >
              Delete Account?
            </Text>
            <Text
              style={[
                styles.deleteBody,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Nunito_400Regular",
                },
              ]}
            >
              This will permanently delete your account, your scores,
              achievements, and notification settings. Your dog and family will
              be kept so other family members can keep training, and so you can
              rejoin with the same sign-in later.
            </Text>
            {deleteError ? (
              <View
                accessibilityRole="alert"
                style={{
                  width: "100%",
                  backgroundColor: colors.destructive + "1A",
                  borderColor: colors.destructive,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.destructive,
                    fontFamily: "Nunito_700Bold",
                    fontSize: 14,
                    textAlign: "center",
                  }}
                >
                  {deleteError}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[
                styles.deleteConfirmBtn,
                {
                  backgroundColor: colors.destructive,
                  opacity: isDeleting ? 0.6 : 1,
                },
              ]}
              onPress={handleDeleteAccount}
              activeOpacity={0.85}
              disabled={isDeleting}
            >
              <Text
                style={[
                  styles.confirmBtnText,
                  { fontFamily: "Nunito_900Black" },
                ]}
              >
                {isDeleting ? "Deleting…" : "Yes, Delete My Account"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteCancelBtn}
              onPress={() => setShowDeleteModal(false)}
              activeOpacity={0.7}
              disabled={isDeleting}
            >
              <Text
                style={[
                  styles.deleteCancelText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Nunito_700Bold",
                  },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { fontSize: 36, marginBottom: 24 },
  section: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1 },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  settingLabel: { fontSize: 16 },
  settingSubLabel: { fontSize: 12, marginTop: 1 },
  settingValue: { fontSize: 14 },
  divider: { height: 1, marginVertical: 14 },
  inviteCode: { fontSize: 18, letterSpacing: 2 },
  signOutRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  signOutText: { fontSize: 16 },
  version: { textAlign: "center", fontSize: 13, marginTop: 8 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  timeLabel: { flex: 1, fontSize: 14 },
  timeValue: { fontSize: 16 },
  // Picker modal
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 4,
  },
  pickerTitle: { fontSize: 24, marginBottom: 12 },
  pickerSectionLabel: { fontSize: 13, marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: 44,
    alignItems: "center",
  },
  timeChipText: { fontSize: 15 },
  previewTime: { fontSize: 40, textAlign: "center", marginVertical: 16 },
  confirmBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  confirmBtnText: { color: "#fff", fontSize: 17 },
  deleteSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 4,
    alignItems: "center",
  },
  deleteIconWrap: { marginBottom: 8 },
  deleteTitle: { fontSize: 26, marginBottom: 8, textAlign: "center" },
  deleteBody: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteConfirmBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
    marginTop: 4,
  },
  deleteCancelBtn: { paddingVertical: 14, alignItems: "center", width: "100%" },
  deleteCancelText: { fontSize: 16 },
});
