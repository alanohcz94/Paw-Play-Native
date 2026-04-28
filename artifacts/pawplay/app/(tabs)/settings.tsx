import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Modal,
  Pressable,
  Share,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/lib/auth";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
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
      const res = await authedFetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleteError("Couldn't delete your account. Please try again.");
        return;
      }
      setShowDeleteModal(false);
      resetState();
      try { await logout(); } catch (err) { console.warn(err); }
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

  // ---- Friends section ----
  const [copied, setCopied] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendError, setFriendError] = useState<string | null>(null);
  const [friendSuccess, setFriendSuccess] = useState<string | null>(null);
  const [friendsList, setFriendsList] = useState<
    { id: string; displayName: string }[]
  >([]);

  const loadFriends = useCallback(async () => {
    try {
      const { authedFetch } = await import("@/lib/authedFetch");
      const res = await authedFetch("/api/friends");
      if (res.ok) {
        const { friends } = await res.json();
        setFriendsList(friends ?? []);
      }
    } catch (e) {
      console.warn("Failed to load friends:", e);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void loadFriends();
  }, [user?.id, loadFriends]);

  // Lazy-fetch own invite code if missing
  useEffect(() => {
    if (inviteCode || !user?.id) return;
    const load = async () => {
      try {
        const { authedFetch } = await import("@/lib/authedFetch");
        const res = await authedFetch("/api/users/me");
        if (res.ok) {
          const me = await res.json();
          if (me?.inviteCode) setInviteCode(me.inviteCode);
        }
      } catch (e) {
        console.warn("Failed to load invite code:", e);
      }
    };
    load();
  }, [inviteCode, user?.id, setInviteCode]);

  const handleRemoveFriendFromList = useCallback(
    (friendId: string, displayName: string) => {
      const performRemove = async () => {
        try {
          const { authedFetch } = await import("@/lib/authedFetch");
          const res = await authedFetch(`/api/friends/${friendId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setFriendsList((prev) => prev.filter((f) => f.id !== friendId));
          }
        } catch (e) {
          console.warn("Failed to remove friend:", e);
        }
      };
      Alert.alert(`Remove ${displayName} from your friends?`, "", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void performRemove() },
      ]);
    },
    [],
  );

  const handleCopyCode = useCallback(async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  const handleShareInvite = useCallback(() => {
    if (!inviteCode) return;
    Share.share({
      message: `Train with me on QuickMix! Use my friend code: ${inviteCode}\n\nDownload QuickMix, sign in, then enter this code in Settings → Add a Friend.`,
      title: "QuickMix Friend Code",
    });
  }, [inviteCode]);

  const handleAddFriend = useCallback(async () => {
    const code = friendCodeInput.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setFriendError("Enter a 6-character friend code.");
      return;
    }
    setAddingFriend(true);
    setFriendError(null);
    setFriendSuccess(null);
    try {
      const { authedFetch } = await import("@/lib/authedFetch");
      const res = await authedFetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const data = await res.json();
        setFriendSuccess(`Added ${data.friend?.displayName ?? "friend"}!`);
        setFriendCodeInput("");
        setTimeout(() => setFriendSuccess(null), 3000);
        await loadFriends();
      } else if (res.status === 404) {
        setFriendError("No one found with that code.");
      } else if (res.status === 409) {
        setFriendError("You're already friends.");
      } else if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        setFriendError(body.error ?? "Invalid code.");
      } else {
        setFriendError("Couldn't add friend. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setFriendError("Something went wrong. Please try again.");
    } finally {
      setAddingFriend(false);
    }
  }, [friendCodeInput]);

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
      if (!val) setReminderTime(null);
      else setShowTimePicker(true);
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
        <Text style={[styles.header, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Settings</Text>

        {/* Notifications */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Notifications</Text>
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingInfo}>
              <Feather name="bell" size={18} color={colors.mutedForeground} />
              <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Push Notifications</Text>
            </View>
            <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: colors.muted, true: colors.peach }} thumbColor="#fff" disabled />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingInfo}>
              <Feather name="clock" size={18} color={colors.mutedForeground} />
              <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Daily Reminder</Text>
            </View>
            <Switch value={remindersOn} onValueChange={handleReminderToggle} trackColor={{ false: colors.muted, true: colors.peach }} thumbColor="#fff" disabled />
          </View>
          {remindersOn && (
            <TouchableOpacity style={[styles.timeRow, { borderColor: colors.border }]} onPress={() => setShowTimePicker(true)} activeOpacity={0.75}>
              <Feather name="sun" size={16} color={colors.peach} />
              <Text style={[styles.timeLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>Reminder time</Text>
              <Text style={[styles.timeValue, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>{reminderDisplay}</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sound */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Sound</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name={soundEnabled ? "volume-2" : "volume-x"} size={18} color={colors.mutedForeground} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Sound Effects</Text>
                <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
                  {soundEnabled ? "Ding on comply, fanfare on complete" : "Muted"}
                </Text>
              </View>
            </View>
            <Switch value={soundEnabled} onValueChange={setSoundEnabled} trackColor={{ false: colors.muted, true: colors.peach }} thumbColor="#fff" />
          </View>
        </View>

        {/* Friends */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.dark, fontFamily: "Nunito_900Black" }]}>Friends</Text>

          {/* Your friend code */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="user" size={18} color={colors.mutedForeground} />
              <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Your Friend Code</Text>
            </View>
            <Text style={[styles.inviteCode, { color: colors.lavender, fontFamily: "Nunito_900Black" }]}>
              {inviteCode ?? "..."}
            </Text>
          </View>

          {inviteCode && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.settingRow} onPress={handleCopyCode} activeOpacity={0.7}>
                <View style={styles.settingInfo}>
                  <Feather name="copy" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Copy Code</Text>
                </View>
                {copied ? (
                  <Text style={[styles.settingValue, { color: colors.mint, fontFamily: "Nunito_700Bold" }]}>Copied!</Text>
                ) : (
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                )}
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.settingRow} onPress={handleShareInvite} activeOpacity={0.7}>
                <View style={styles.settingInfo}>
                  <Feather name="share-2" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>Share Code</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}

          {/* Add a Friend */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold", marginBottom: 8 }]}>
            Add a Friend
          </Text>
          <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular", marginBottom: 12 }]}>
            Enter their 6-character friend code
          </Text>
          <View style={styles.addFriendRow}>
            <TextInput
              style={[
                styles.codeInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.dark,
                  fontFamily: "Nunito_900Black",
                },
              ]}
              value={friendCodeInput}
              onChangeText={(t) => {
                setFriendCodeInput(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                setFriendError(null);
              }}
              placeholder="ABC123"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <TouchableOpacity
              style={[
                styles.addFriendBtn,
                {
                  backgroundColor: colors.peach,
                  opacity: friendCodeInput.length === 6 && !addingFriend ? 1 : 0.5,
                },
              ]}
              onPress={handleAddFriend}
              disabled={friendCodeInput.length !== 6 || addingFriend}
              activeOpacity={0.85}
            >
              {addingFriend ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.addFriendBtnText, { fontFamily: "Nunito_900Black" }]}>Add</Text>
              )}
            </TouchableOpacity>
          </View>
          {friendError && (
            <Text style={[styles.friendError, { color: colors.destructive, fontFamily: "Nunito_700Bold" }]}>{friendError}</Text>
          )}
          {friendSuccess && (
            <Text style={[styles.friendSuccess, { color: colors.mint, fontFamily: "Nunito_700Bold" }]}>{friendSuccess}</Text>
          )}

          {/* Your friends list */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.settingLabel, { color: colors.dark, fontFamily: "Nunito_700Bold", marginBottom: 8 }]}>
            Your Friends ({friendsList.length})
          </Text>
          {friendsList.length === 0 ? (
            <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
              You haven't added anyone yet.
            </Text>
          ) : (
            <>
              <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular", marginBottom: 8 }]}>
                Tap the X to remove a friend (you'll both stop seeing each other).
              </Text>
              {friendsList.map((f) => (
                <View
                  key={f.id}
                  style={[styles.friendRow, { borderColor: colors.border }]}
                >
                  <View style={[styles.friendAvatar, { backgroundColor: colors.lavLight }]}>
                    <Text style={[styles.friendAvatarText, { color: colors.lavender, fontFamily: "Nunito_900Black" }]}>
                      {(f.displayName ?? "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.friendRowName, { color: colors.dark, fontFamily: "Nunito_700Bold" }]}>
                    {f.displayName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveFriendFromList(f.id, f.displayName)}
                    activeOpacity={0.7}
                    style={styles.friendRemoveBtn}
                    accessibilityLabel={`Remove ${f.displayName}`}
                  >
                    <Feather name="x" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Account */}
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
          <TouchableOpacity style={styles.signOutRow} onPress={handleLogout} activeOpacity={0.7}>
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive, fontFamily: "Nunito_700Bold" }]}>Sign Out</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.signOutRow} onPress={() => setShowDeleteModal(true)} activeOpacity={0.7}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
            <Text style={[styles.signOutText, { color: colors.destructive, fontFamily: "Nunito_700Bold" }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>QuickMix v1.0.0</Text>
      </ScrollView>

      {/* Time picker modal */}
      <Modal transparent animationType="slide" visible={showTimePicker} onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowTimePicker(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.pickerTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Set Reminder Time</Text>

            <Text style={[styles.pickerSectionLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Hour</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {HOURS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.timeChip, { backgroundColor: pickerH === h ? colors.peach : colors.muted }]}
                  onPress={() => setPickerH(h)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timeChipText, { color: pickerH === h ? "#fff" : colors.dark, fontFamily: "Nunito_700Bold" }]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.pickerSectionLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Minute</Text>
            <View style={styles.chipRow}>
              {MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.timeChip, { backgroundColor: pickerM === m ? colors.peach : colors.muted }]}
                  onPress={() => setPickerM(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timeChipText, { color: pickerM === m ? "#fff" : colors.dark, fontFamily: "Nunito_700Bold" }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.pickerSectionLabel, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Period</Text>
            <View style={styles.chipRow}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.timeChip, { backgroundColor: pickerP === p ? colors.peach : colors.muted }]}
                  onPress={() => setPickerP(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timeChipText, { color: pickerP === p ? "#fff" : colors.dark, fontFamily: "Nunito_700Bold" }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.previewTime, { color: colors.peach, fontFamily: "FredokaOne_400Regular" }]}>
              {pickerH}:{pickerM} {pickerP}
            </Text>

            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.peach }]} onPress={confirmTime} activeOpacity={0.85}>
              <Text style={[styles.confirmBtnText, { fontFamily: "Nunito_900Black" }]}>Set Reminder</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete account modal */}
      <Modal transparent animationType="fade" visible={showDeleteModal} onRequestClose={() => setShowDeleteModal(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => !isDeleting && setShowDeleteModal(false)}>
          <Pressable style={[styles.deleteSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={styles.deleteIconWrap}>
              <Feather name="trash-2" size={32} color={colors.destructive} />
            </View>
            <Text style={[styles.deleteTitle, { color: colors.dark, fontFamily: "FredokaOne_400Regular" }]}>Delete Account?</Text>
            <Text style={[styles.deleteBody, { color: colors.mutedForeground, fontFamily: "Nunito_400Regular" }]}>
              This permanently deletes your account, your dogs, all their training history, and all your friendships. This cannot be undone.
            </Text>
            {deleteError && (
              <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "1A", borderColor: colors.destructive }]}>
                <Text style={[styles.errorBannerText, { color: colors.destructive, fontFamily: "Nunito_700Bold" }]}>{deleteError}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.deleteConfirmBtn, { backgroundColor: colors.destructive, opacity: isDeleting ? 0.6 : 1 }]}
              onPress={handleDeleteAccount}
              activeOpacity={0.85}
              disabled={isDeleting}
            >
              <Text style={[styles.confirmBtnText, { fontFamily: "Nunito_900Black" }]}>
                {isDeleting ? "Deleting…" : "Yes, Delete My Account"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setShowDeleteModal(false)} activeOpacity={0.7} disabled={isDeleting}>
              <Text style={[styles.deleteCancelText, { color: colors.mutedForeground, fontFamily: "Nunito_700Bold" }]}>Cancel</Text>
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
  sectionTitle: { fontSize: 15, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  settingLabel: { fontSize: 16 },
  settingSubLabel: { fontSize: 12, marginTop: 1 },
  settingValue: { fontSize: 14 },
  divider: { height: 1, marginVertical: 14 },
  inviteCode: { fontSize: 18, letterSpacing: 2 },
  signOutRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  signOutText: { fontSize: 16 },
  version: { textAlign: "center", fontSize: 13, marginTop: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  timeLabel: { flex: 1, fontSize: 14 },
  timeValue: { fontSize: 16 },
  addFriendRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  codeInput: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, letterSpacing: 2, textAlign: "center" },
  addFriendBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12, minWidth: 72, alignItems: "center" },
  addFriendBtnText: { color: "#fff", fontSize: 15 },
  friendError: { fontSize: 13, marginTop: 8 },
  friendSuccess: { fontSize: 13, marginTop: 8 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatarText: { fontSize: 14 },
  friendRowName: { flex: 1, fontSize: 15 },
  friendRemoveBtn: { padding: 6, borderRadius: 16 },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  pickerTitle: { fontSize: 24, marginBottom: 12 },
  pickerSectionLabel: { fontSize: 13, marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, minWidth: 44, alignItems: "center" },
  timeChipText: { fontSize: 15 },
  previewTime: { fontSize: 40, textAlign: "center", marginVertical: 16 },
  confirmBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  confirmBtnText: { color: "#fff", fontSize: 17 },
  deleteSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4, alignItems: "center" },
  deleteIconWrap: { marginBottom: 8 },
  deleteTitle: { fontSize: 26, marginBottom: 8, textAlign: "center" },
  deleteBody: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  deleteConfirmBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center", width: "100%", marginTop: 4 },
  deleteCancelBtn: { paddingVertical: 14, alignItems: "center", width: "100%" },
  deleteCancelText: { fontSize: 16 },
  errorBanner: { width: "100%", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  errorBannerText: { fontSize: 14, textAlign: "center" },
});
