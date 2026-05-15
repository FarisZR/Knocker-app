import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function ignoreHapticFailure(promise: Promise<void>) {
  void promise.catch(() => {});
}

export function performKnockHaptic() {
  if (Platform.OS === "android") {
    ignoreHapticFailure(
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm),
    );
    return;
  }

  if (Platform.OS !== "web") {
    ignoreHapticFailure(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }
}

export function performTapHaptic() {
  if (Platform.OS === "android") {
    ignoreHapticFailure(
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click),
    );
    return;
  }

  if (Platform.OS !== "web") {
    ignoreHapticFailure(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }
}
