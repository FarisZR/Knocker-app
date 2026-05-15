import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function performKnockHaptic() {
  if (Platform.OS === "android") {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
    return;
  }

  if (Platform.OS !== "web") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}
