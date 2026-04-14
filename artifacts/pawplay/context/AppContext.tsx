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
  dogs: Dog[];
  activeDogId: string | null;
  dog: Dog | null;
  commands: Command[];
  familyId: string | null;
  streak: number;
  lastTrainedDate: string | null;
  isNewUser: boolean;
  onboardingComplete: boolean;
  seenAchievements: string[];
  reminderTime: string | null;
  soundEnabled: boolean;
}

interface AppContextValue extends AppState {
  setDog: (dog: Dog | null) => void;
  setDogs: (dogs: Dog[]) => void;
  setActiveDogId: (id: string | null) => void;
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
  addDog: (dog: Dog) => void;
}

const AppContext = createContext<AppContextValue>({
  dogs: [],
  activeDogId: null,
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
  setDogs: () => {},
  setActiveDogId: () => {},
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
  addDog: () => {},
});

const STORAGE_KEY = "pawplay_app_state";

export function AppProvider({ children }: { children: ReactNode }) {
  const [dogs, setDogsState] = useState<Dog[]>([]);
  const [activeDogId, setActiveDogIdState] = useState<string | null>(null);
  const [commands, setCommandsState] = useState<Command[]>([]);
  const [familyId, setFamilyIdState] = useState<string | null>(null);
  const [streak, setStreakState] = useState(0);
  const [lastTrainedDate, setLastTrainedDateState] = useState<string | null>(null);
  const [isNewUser, setIsNewUserState] = useState(true);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [seenAchievements, setSeenAchievementsState] = useState<string[]>([]);
  const [reminderTime, setReminderTimeState] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);

  const dog = dogs.find((d) => d.id === activeDogId) ?? dogs[0] ?? null;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.dogs && saved.dogs.length > 0) {
          setDogsState(saved.dogs);
          setActiveDogIdState(saved.activeDogId ?? saved.dogs[0]?.id ?? null);
        } else if (saved.dog) {
          setDogsState([saved.dog]);
          setActiveDogIdState(saved.dog.id);
        }
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

  const save = (patch: Partial<Record<string, unknown>>) => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      const existing = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...patch }));
    });
  };

  const setDog = (d: Dog | null) => {
    if (!d) return;
    setDogsState((prev) => {
      const idx = prev.findIndex((p) => p.id === d.id);
      const next = idx >= 0 ? prev.map((p) => (p.id === d.id ? d : p)) : [...prev, d];
      save({ dogs: next, activeDogId: d.id });
      return next;
    });
    setActiveDogIdState(d.id);
  };

  const setDogs = (d: Dog[]) => {
    setDogsState(d);
    const currentStillValid = d.some((dog) => dog.id === activeDogId);
    if (!currentStillValid && d.length > 0) {
      setActiveDogIdState(d[0].id);
      save({ dogs: d, activeDogId: d[0].id });
    } else {
      save({ dogs: d });
    }
  };

  const setActiveDogId = (id: string | null) => {
    setActiveDogIdState(id);
    save({ activeDogId: id });
  };

  const addDog = (d: Dog) => {
    setDogsState((prev) => {
      const next = [...prev, d];
      save({ dogs: next, activeDogId: d.id });
      return next;
    });
    setActiveDogIdState(d.id);
  };

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
      dogs, activeDogId, dog, commands, familyId, streak, lastTrainedDate, isNewUser, onboardingComplete,
      seenAchievements, reminderTime, soundEnabled,
      setDog, setDogs, setActiveDogId, addDog, setCommands, setFamilyId, setStreak, setLastTrainedDate,
      setIsNewUser, setOnboardingComplete, refreshStreak,
      markAchievementSeen, setReminderTime, setSoundEnabled,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
