import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { useProfiles, type SnackbarState } from "@/context/ProfilesContext";

const AUTO_DISMISS_MS = 4500;

export function Snackbar({ bottomOffset }: { bottomOffset: number }) {
  const colors = useColors();
  const { snackbar, dismissSnackbar } = useProfiles();

  useEffect(() => {
    if (!snackbar || snackbar.persistent) return;
    const t = setTimeout(dismissSnackbar, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [snackbar, dismissSnackbar]);

  if (!snackbar) return null;

  const tone: SnackbarState["tone"] = snackbar.tone;
  const iconName =
    tone === "success" ? "check-circle" : tone === "error" ? "alert-circle" : "info";
  const iconColor =
    tone === "success" ? colors.success : tone === "error" ? colors.destructive : colors.primary;

  return (
    <Animated.View
      key={snackbar.id}
      entering={FadeInDown.duration(220).springify().damping(18)}
      exiting={FadeOutDown.duration(180)}
      style={[
        styles.wrap,
        { bottom: bottomOffset, backgroundColor: colors.foreground },
      ]}
    >
      <Feather name={iconName} size={20} color={iconColor} />
      <View style={styles.body}>
        <Text style={[styles.text, { color: colors.background }]} numberOfLines={1}>
          {snackbar.text}
        </Text>
        {snackbar.detail ? (
          <Text
            style={[styles.detail, { color: colors.background, opacity: 0.7 }]}
            numberOfLines={1}
          >
            {snackbar.detail}
          </Text>
        ) : null}
      </View>
      {snackbar.retry ? (
        <Pressable
          onPress={() => {
            const r = snackbar.retry;
            dismissSnackbar();
            r?.();
          }}
          hitSlop={8}
        >
          <Text style={[styles.action, { color: colors.primary }]}>RETRY</Text>
        </Pressable>
      ) : (
        <Pressable onPress={dismissSnackbar} hitSlop={8}>
          <Feather name="x" size={18} color={colors.background} style={{ opacity: 0.7 }} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  body: { flex: 1 },
  text: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  detail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  action: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    paddingHorizontal: 6,
  },
});
