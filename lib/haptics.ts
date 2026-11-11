import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function ignoreHapticFailure(promise: Promise<void>) {
  void promise.catch(() => {});
}

/** Acknowledges a dispatched knock without waiting for haptic completion. */
export function performKnockHaptic() {
  if (Platform.OS !== "web") {
    ignoreHapticFailure(
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click),
    );
  }
}

/** Provides optional navigation feedback without delaying the action. */
export function performTapHaptic() {
  if (Platform.OS !== "web") {
    ignoreHapticFailure(
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click),
    );
  }
}

/** Signals success or failure asynchronously on platforms that support haptics. */
export function performResultHaptic(success: boolean) {
  if (Platform.OS === "android") {
    ignoreHapticFailure(
      Haptics.performAndroidHapticsAsync(
        success
          ? Haptics.AndroidHaptics.Confirm
          : Haptics.AndroidHaptics.Reject,
      ),
    );
  } else if (Platform.OS !== "web") {
    ignoreHapticFailure(
      Haptics.notificationAsync(
        success
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ),
    );
  }
}
