import { useCallback } from "react";
import { useApp } from "@/context/AppContext";

type SoundName = "ding" | "success" | "achievement";

const SOUND_FILES: Record<SoundName, any> = {
  ding: require("../assets/sounds/ding.wav"),
  success: require("../assets/sounds/success.wav"),
  achievement: require("../assets/sounds/achievement.wav"),
};

export function useSound() {
  const { soundEnabled } = useApp();

  const play = useCallback(async (name: SoundName) => {
    if (!soundEnabled) return;
    try {
      const { Audio } = await import("expo-av");
      const { sound } = await Audio.Sound.createAsync(SOUND_FILES[name], { shouldPlay: true, volume: 0.7 });
      // Unload after playback to free memory
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch {
      // expo-av not available or sound file missing — silent fallback
    }
  }, [soundEnabled]);

  return { play };
}
