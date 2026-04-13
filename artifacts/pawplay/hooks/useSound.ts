import { useCallback } from "react";
import { useApp } from "@/context/AppContext";

type SoundName = "ding" | "success" | "achievement";

export function useSound() {
  const { soundEnabled } = useApp();

  const play = useCallback(
    async (name: SoundName) => {
      if (!soundEnabled) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ExpoAV = require("expo-av");

        // Static requires so Metro can resolve each path at bundle time.
        const assets: Record<SoundName, any> = {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          ding: require("../assets/sounds/ding.wav"),
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          success: require("../assets/sounds/success.wav"),
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          achievement: require("../assets/sounds/achievement.wav"),
        };

        const { sound } = await ExpoAV.Audio.Sound.createAsync(assets[name], {
          shouldPlay: true,
          volume: 0.7,
        });

        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status?.isLoaded && status?.didJustFinish) {
            sound.unloadAsync().catch(() => {});
          }
        });
      } catch {
        // expo-av not installed or sound file missing — silent no-op.
      }
    },
    [soundEnabled],
  );

  return { play };
}
