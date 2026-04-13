import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Dog {
  id: string;
  familyId: string;
  name: string;
  age?: number | null;
  breed?: string | null;
  avatarUrl?: string | null;
  level: number;
  xp: number;
  releaseCue?: string;
  markerCue?: string;
}

export interface Command {
  id: string;
  dogId: string;
  name: string;
  level: number;
  trainingSessionsCount: number;
  qbSuccessesCount: number;
  qbSessionsWithSuccess: number;
  lastUsedAt?: string | null;
  addedAt: string;
}

export interface AppState {
  dog: Dog | null;
  commands: Command[];
  familyId: string | null;
  streak: number;
  lastTrainedDate: string | null;
  isNewUser: boolean;
  onboardingComplete: boolean;
  seenAchievements: string[];
  reminderTime: string | null; // "HH:MM" 24h format, e.g. "07:30"
  soundEnabled: boolean;
}

interface AppContextValue extends AppState {
  setDog: (dog: Dog | null) => void;
  setCommands: (commands: Command[]) => void;
  setFamilyId: (id: string | null) => void;
  setStreak: (streak: number) => void;
  setLastTrainedDate: (date: string | null) => void;
  setIsNewUser: (v: boolean) => void;
  setOnboardingComplete: (v: boolean) => void;
  refreshStreak: () => void;
  markAchievementSeen: (type: string) => void;
  setReminderTime: (time: string | null) => void;
  setSoundEnabled: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue>({
  dog: null,
  commands: [],
  familyId: null,
  streak: 0,
  lastTrainedDate: null,
  isNewUser: true,
  onboardingComplete: false,
  seenAchievements: [],
  reminderTime: null,
  soundEnabled: true,
  setDog: () => {},
  setCommands: () => {},
  setFamilyId: () => {},
  setStreak: () => {},
  setLastTrainedDate: () => {},
  setIsNewUser: () => {},
  setOnboardingComplete: () => {},
  refreshStreak: () => {},
  markAchievementSeen: () => {},
  setReminderTime: () => {},
  setSoundEnabled: () => {},
});

const STORAGE_KEY = "pawplay_app_state";

export function AppProvider({ children }: { children: ReactNode }) {
  const [dog, setDogState] = useState<Dog | null>(null);
  const [commands, setCommandsState] = useState<Command[]>([]);
  const [familyId, setFamilyIdState] = useState<string | null>(null);
  const [streak, setStreakState] = useState(0);
  const [lastTrainedDate, setLastTrainedDateState] = useState<string | null>(null);
  const [isNewUser, setIsNewUserState] = useState(true);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [seenAchievements, setSeenAchievementsState] = useState<string[]>([]);
  const [reminderTime, setReminderTimeState] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.dog) setDogState(saved.dog);
        if (saved.commands) setCommandsState(saved.commands);
        if (saved.familyId) setFamilyIdState(saved.familyId);
        if (saved.streak !== undefined) setStreakState(saved.streak);
        if (saved.lastTrainedDate) setLastTrainedDateState(saved.lastTrainedDate);
        if (saved.isNewUser !== undefined) setIsNewUserState(saved.isNewUser);
        if (saved.onboardingComplete !== undefined) setOnboardingCompleteState(saved.onboardingComplete);
        if (saved.seenAchievements) setSeenAchievementsState(saved.seenAchievements);
        if (saved.reminderTime !== undefined) setReminderTimeState(saved.reminderTime);
        if (saved.soundEnabled !== undefined) setSoundEnabledState(saved.soundEnabled);
      } catch {}
    });
  }, []);

  const save = (patch: Partial<AppState>) => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      const existing = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...patch }));
    });
  };

  const setDog = (d: Dog | null) => { setDogState(d); save({ dog: d ?? undefined }); };
  const setCommands = (c: Command[]) => { setCommandsState(c); save({ commands: c }); };
  const setFamilyId = (id: string | null) => { setFamilyIdState(id); save({ familyId: id ?? undefined }); };
  const setStreak = (s: number) => { setStreakState(s); save({ streak: s }); };
  const setLastTrainedDate = (d: string | null) => { setLastTrainedDateState(d); save({ lastTrainedDate: d ?? undefined }); };
  const setIsNewUser = (v: boolean) => { setIsNewUserState(v); save({ isNewUser: v }); };
  const setOnboardingComplete = (v: boolean) => { setOnboardingCompleteState(v); save({ onboardingComplete: v }); };
  const markAchievementSeen = (type: string) => {
    setSeenAchievementsState((prev) => {
      if (prev.includes(type)) return prev;
      const next = [...prev, type];
      save({ seenAchievements: next });
      return next;
    });
  };
  const setReminderTime = (time: string | null) => { setReminderTimeState(time); save({ reminderTime: time ?? undefined }); };
  const setSoundEnabled = (v: boolean) => { setSoundEnabledState(v); save({ soundEnabled: v }); };

  const refreshStreak = () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (!lastTrainedDate) return;
    const last = new Date(lastTrainedDate).toDateString();
    if (last === today) return;
    if (last === yesterday) {
      const newStreak = streak + 1;
      setStreakState(newStreak);
      setLastTrainedDateState(new Date().toISOString());
      save({ streak: newStreak, lastTrainedDate: new Date().toISOString() });
    } else {
      setStreakState(0);
      save({ streak: 0 });
    }
  };

  return (
    <AppContext.Provider value={{
      dog, commands, familyId, streak, lastTrainedDate, isNewUser, onboardingComplete,
      seenAchievements, reminderTime, soundEnabled,
      setDog, setCommands, setFamilyId, setStreak, setLastTrainedDate, setIsNewUser, setOnboardingComplete, refreshStreak,
      markAchievementSeen, setReminderTime, setSoundEnabled,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
