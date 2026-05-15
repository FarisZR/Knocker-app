import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  canScheduleExactAlarms,
  isNativeAvailable,
  openExactAlarmSettings,
} from "knocker-native";

/**
 * Compact banner that explains the state of native Android features:
 *   - Hidden on iOS / web entirely.
 *   - Hidden when the native module is unavailable.
 *   - On Android dev/prod build: only shows a warning if exact alarm
 *     permission has been revoked.
 */
export function DevBuildBanner() {
  const colors = useColors();
  const [exactAlarms, setExactAlarms] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isNativeAvailable) return;
    let cancelled = false;
    void (async () => {
      const ok = await canScheduleExactAlarms();
      if (!cancelled) setExactAlarms(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS !== "android") return null;
  if (!isNativeAvailable) return null;

  if (exactAlarms === false) {
    return (
      <Pressable
        onPress={() => void openExactAlarmSettings()}
        style={({ pressed }) => [
          styles.banner,
          {
            backgroundColor: colors.surface,
            borderColor: colors.destructive,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="alert-triangle" size={14} color={colors.destructive} />
        <Text style={[styles.text, { color: colors.foreground }]}>
          Exact alarms disabled - auto-renew may fire late. Tap to open
          settings.
        </Text>
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 6,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 16,
  },
});
