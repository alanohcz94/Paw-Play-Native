import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef, type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Dog {
  id: string;
  userId: string;
  name: string;
  age?: number | null;
  breed?: string | null;
  avatarUrl?: string | null;
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
  blitzSuccessesCount: number;
  lastUsedAt?: string | null;
  addedAt: string;
}

interface DogStreak {
  streak: number;
  lastTrainedDate: string | null;
}

export interface AppState {
  dogs: Dog[];
  activeDogId: string | null;
  dog: Dog | null;
  commands: Command[];
  inviteCode: string | null;
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
  setInviteCode: (code: string | null) => void;
  setStreak: (streak: number) => void;
  setLastTrainedDate: (date: string | null) => void;
  updateUserStreak: () => void;
  setIsNewUser: (v: boolean) => void;
  setOnboardingComplete: (v: boolean) => void;
  refreshStreak: () => void;
  markAchievementSeen: (type: string) => void;
  setReminderTime: (time: string | null) => void;
  setSoundEnabled: (v: boolean) => void;
  addDog: (dog: Dog) => void;
  loadDogsFromApi: (userId: string) => Promise<void>;
  resetState: () => void;
}

const AppContext = createContext<AppContextValue>({
  dogs: [], activeDogId: null, dog: null, commands: [],
  inviteCode: null, streak: 0, lastTrainedDate: null, isNewUser: true,
  onboardingComplete: false, seenAchievements: [], reminderTime: null, soundEnabled: true,
  setDog: () => {}, setDogs: () => {}, setActiveDogId: () => {}, setCommands: () => {},
  setInviteCode: () => {}, setStreak: () => {},
  setLastTrainedDate: () => {}, updateUserStreak: () => {}, setIsNewUser: () => {}, setOnboardingComplete: () => {},
  refreshStreak: () => {}, markAchievementSeen: () => {}, setReminderTime: () => {},
  setSoundEnabled: () => {}, addDog: () => {}, loadDogsFromApi: async () => {}, resetState: () => {},
});

const STORAGE_KEY = "pawplay_app_state";

export function AppProvider({ children }: { children: ReactNode }) {
  const [dogs, setDogsState] = useState<Dog[]>([]);
  const [activeDogId, setActiveDogIdState] = useState<string | null>(null);
  const [commands, setCommandsState] = useState<Command[]>([]);
  const [inviteCode, setInviteCodeState] = useState<string | null>(null);
  const [dogStreaks, setDogStreaksState] = useState<Record<string, DogStreak>>({});
  const [dogSeenAchievements, setDogSeenAchievementsState] = useState<Record<string, string[]>>({});
  const [isNewUser, setIsNewUserState] = useState(true);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [reminderTime, setReminderTimeState] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [userStreakState, setUserStreakState] = useState(0);
  const [userLastTrainedDateState, setUserLastTrainedDateState] = useState<string | null>(null);

  // Snapshot ref — avoids async read-before-write on every save call
  const persistedRef = useRef<Record<string, unknown>>({});

  const save = useCallback((patch: Record<string, unknown>) => {
    persistedRef.current = { ...persistedRef.current, ...patch };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistedRef.current));
  }, []);

  // Derived values — stable references, recomputed only when deps change
  const dog = useMemo(
    () => dogs.find((d) => d.id === activeDogId) ?? dogs[0] ?? null,
    [dogs, activeDogId],
  );
  const activeDogKey = dog?.id ?? "__none__";

  // User-level streak (any dog, any mode, consecutive calendar days)
  const streak = userStreakState;
  const lastTrainedDate = userLastTrainedDateState;
  const seenAchievements = useMemo(
    () => dogSeenAchievements[activeDogKey] ?? [],
    [dogSeenAchievements, activeDogKey],
  );

  // Hydrate from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        // Seed the ref so future saves don't lose older keys
        persistedRef.current = saved;

        if (saved.dogs && saved.dogs.length > 0) {
          setDogsState(saved.dogs);
          setActiveDogIdState(saved.activeDogId ?? saved.dogs[0]?.id ?? null);
        } else if (saved.dog) {
          setDogsState([saved.dog]);
          setActiveDogIdState(saved.dog.id);
        }
        if (saved.commands) setCommandsState(saved.commands);
        if (saved.inviteCode) setInviteCodeState(saved.inviteCode);

        if (saved.dogStreaks) {
          setDogStreaksState(saved.dogStreaks);
        } else if (saved.streak !== undefined) {
          const mid = saved.activeDogId ?? saved.dog?.id ?? saved.dogs?.[0]?.id;
          if (mid) setDogStreaksState({ [mid]: { streak: saved.streak, lastTrainedDate: saved.lastTrainedDate ?? null } });
        }

        if (saved.dogSeenAchievements) {
          setDogSeenAchievementsState(saved.dogSeenAchievements);
        } else if (saved.seenAchievements) {
          const mid = saved.activeDogId ?? saved.dog?.id ?? saved.dogs?.[0]?.id;
          if (mid) setDogSeenAchievementsState({ [mid]: saved.seenAchievements });
        }

        if (saved.isNewUser !== undefined) setIsNewUserState(saved.isNewUser);
        if (saved.onboardingComplete !== undefined) setOnboardingCompleteState(saved.onboardingComplete);
        if (saved.reminderTime !== undefined) setReminderTimeState(saved.reminderTime);
        if (saved.soundEnabled !== undefined) setSoundEnabledState(saved.soundEnabled);
        if (saved._userStreak !== undefined) setUserStreakState(saved._userStreak);
        if (saved._userLastTrainedDate !== undefined) setUserLastTrainedDateState(saved._userLastTrainedDate);
      } catch (e) {
        console.warn("Failed to restore persisted app state:", e);
      }
    });
  }, []);

  const loadCommandsForDog = useCallback(async (dogId: string) => {
    try {
      const { authedFetch } = await import("@/lib/authedFetch");
      const res = await authedFetch(`/api/dogs/${dogId}/commands`);
      if (res.ok) {
        const { commands: cmds } = await res.json();
        setCommandsState(cmds);
        save({ commands: cmds });
      }
    } catch (e) {
      console.error("Failed to load commands for dog:", e);
    }
  }, [save]);

  const setDog = useCallback((d: Dog | null) => {
    if (!d) {
      setDogsState([]);
      setActiveDogIdState(null);
      setCommandsState([]);
      save({ dogs: [], activeDogId: null, commands: [] });
      return;
    }
    setDogsState((prev) => {
      const idx = prev.findIndex((p) => p.id === d.id);
      const next = idx >= 0 ? prev.map((p) => (p.id === d.id ? d : p)) : [...prev, d];
      save({ dogs: next, activeDogId: d.id });
      return next;
    });
    setActiveDogIdState(d.id);
  }, [save]);

  const setDogs = useCallback((d: Dog[]) => {
    setDogsState(d);
    if (d.length === 0) {
      setActiveDogIdState(null);
      setCommandsState([]);
      save({ dogs: d, activeDogId: null, commands: [] });
      return;
    }
    setActiveDogIdState((currentId) => {
      const stillValid = d.some((dg) => dg.id === currentId);
      const nextId = stillValid ? currentId! : d[0].id;
      save({ dogs: d, activeDogId: nextId });
      return nextId;
    });
  }, [save]);

  const setActiveDogId = useCallback((id: string | null) => {
    setActiveDogIdState(id);
    save({ activeDogId: id });
    if (id) loadCommandsForDog(id);
  }, [save, loadCommandsForDog]);

  const addDog = useCallback((d: Dog) => {
    setDogsState((prev) => {
      const next = [...prev, d];
      save({ dogs: next, activeDogId: d.id });
      return next;
    });
    setActiveDogIdState(d.id);
  }, [save]);

  const loadDogsFromApi = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const { authedFetch } = await import("@/lib/authedFetch");
      const res = await authedFetch(`/api/users/${userId}/dogs`);
      if (res.ok) {
        const { dogs: fetchedDogs } = await res.json();
        if (fetchedDogs && fetchedDogs.length > 0) {
          setDogsState(fetchedDogs);
          setActiveDogIdState((currentId) => {
            const validActive = fetchedDogs.some((d: Dog) => d.id === currentId);
            const newActiveId = validActive ? currentId! : fetchedDogs[0].id;
            save({ dogs: fetchedDogs, activeDogId: newActiveId });
            loadCommandsForDog(newActiveId);
            return newActiveId;
          });
        } else {
          setDogsState([]);
          setActiveDogIdState(null);
          setCommandsState([]);
          save({ dogs: [], activeDogId: null, commands: [] });
        }
      }
    } catch (e) {
      console.error("Failed to load dogs:", e);
    }
  }, [save, loadCommandsForDog]);

  const setCommands = useCallback((c: Command[]) => {
    setCommandsState(c);
    save({ commands: c });
  }, [save]);

  const setInviteCode = useCallback((code: string | null) => {
    setInviteCodeState(code);
    save({ inviteCode: code ?? undefined });
  }, [save]);

  const setStreak = useCallback((s: number) => {
    setDogStreaksState((prev) => {
      const key = prev[activeDogKey] ? activeDogKey : activeDogKey;
      const next = { ...prev, [key]: { ...(prev[key] ?? { lastTrainedDate: null }), streak: s } };
      save({ dogStreaks: next });
      return next;
    });
  }, [save, activeDogKey]);

  const setLastTrainedDate = useCallback((d: string | null) => {
    setDogStreaksState((prev) => {
      const next = { ...prev, [activeDogKey]: { ...(prev[activeDogKey] ?? { streak: 0 }), lastTrainedDate: d } };
      save({ dogStreaks: next });
      return next;
    });
  }, [save, activeDogKey]);

  const setIsNewUser = useCallback((v: boolean) => {
    setIsNewUserState(v);
    save({ isNewUser: v });
  }, [save]);

  const setOnboardingComplete = useCallback((v: boolean) => {
    setOnboardingCompleteState(v);
    save({ onboardingComplete: v });
  }, [save]);

  const markAchievementSeen = useCallback((type: string) => {
    setDogSeenAchievementsState((prev) => {
      const existing = prev[activeDogKey] ?? [];
      if (existing.includes(type)) return prev;
      const next = { ...prev, [activeDogKey]: [...existing, type] };
      save({ dogSeenAchievements: next });
      return next;
    });
  }, [save, activeDogKey]);

  const setReminderTime = useCallback((time: string | null) => {
    setReminderTimeState(time);
    save({ reminderTime: time ?? undefined });
  }, [save]);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    save({ soundEnabled: v });
  }, [save]);

  const refreshStreak = useCallback(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (!lastTrainedDate) return;
    const last = new Date(lastTrainedDate).toDateString();
    if (last === today) return;
    setDogStreaksState((prev) => {
      const newStreak = last === yesterday ? (prev[activeDogKey]?.streak ?? 0) + 1 : 0;
      const next = {
        ...prev,
        [activeDogKey]: { streak: newStreak, lastTrainedDate: last === yesterday ? new Date().toISOString() : prev[activeDogKey]?.lastTrainedDate ?? null },
      };
      save({ dogStreaks: next });
      return next;
    });
  }, [save, activeDogKey, lastTrainedDate]);

  // Call this once per completed session (any dog, any mode).
  // Increments the user-level streak if this is the first session today.
  const updateUserStreak = useCallback(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    setUserStreakState((prev) => {
      const lastDate = userLastTrainedDateState
        ? new Date(userLastTrainedDateState).toDateString()
        : null;
      if (lastDate === today) return prev; // already trained today
      const newStreak = lastDate === yesterday ? prev + 1 : 1;
      setUserLastTrainedDateState(today);
      save({ _userStreak: newStreak, _userLastTrainedDate: today });
      return newStreak;
    });
  }, [save, userLastTrainedDateState]);

  const resetState = useCallback(() => {
    setDogsState([]);
    setActiveDogIdState(null);
    setCommandsState([]);
    setInviteCodeState(null);
    setDogStreaksState({});
    setDogSeenAchievementsState({});
    setIsNewUserState(true);
    setOnboardingCompleteState(false);
    setUserStreakState(0);
    setUserLastTrainedDateState(null);
    persistedRef.current = {};
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  // Stable context value — only changes when actual state changes
  const value = useMemo<AppContextValue>(() => ({
    dogs, activeDogId, dog, commands, inviteCode, streak, lastTrainedDate,
    isNewUser, onboardingComplete, seenAchievements, reminderTime, soundEnabled,
    setDog, setDogs, setActiveDogId, addDog, setCommands, setInviteCode,
    setStreak, setLastTrainedDate, updateUserStreak, setIsNewUser, setOnboardingComplete, refreshStreak,
    markAchievementSeen, setReminderTime, setSoundEnabled, loadDogsFromApi, resetState,
  }), [
    dogs, activeDogId, dog, commands, inviteCode, streak, lastTrainedDate,
    isNewUser, onboardingComplete, seenAchievements, reminderTime, soundEnabled,
    setDog, setDogs, setActiveDogId, addDog, setCommands, setInviteCode,
    setStreak, setLastTrainedDate, updateUserStreak, setIsNewUser, setOnboardingComplete, refreshStreak,
    markAchievementSeen, setReminderTime, setSoundEnabled, loadDogsFromApi, resetState,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
