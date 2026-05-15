import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function ignoreHapticFailure(promise: Promise<void>) {
  void promise.catch(() => {});
}

export function performKnockHaptic() {
  if (Platform.OS !== "web") {
    ignoreHapticFailure(
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm),
    );
  }
}

export function performTapHaptic() {
  if (Platform.OS !== "web") {
    ignoreHapticFailure(
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click),
    );
  }
}
