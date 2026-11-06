import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function ignoreHapticFailure(promise: Promise<void>) {
  void promise.catch(() => {});
}

export function performKnockHaptic() {
  if (Platform.OS !== "web") {
    ignoreHapticFailure(
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click),
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
