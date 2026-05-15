import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";

import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useColors } from "@/hooks/useColors";
import { useProfiles } from "@/context/ProfilesContext";
import { motion } from "@/constants/motion";
import { formatCountdown, formatHostname } from "@/lib/format";
import type { Profile } from "@/lib/profiles";

export function ProfileCard({
  profile,
  index = 0,
}: {
  profile: Profile;
  index?: number;
}) {
  const colors = useColors();
  const { knockOne } = useProfiles();
  const [now, setNow] = useState(Date.now());
  const [knocking, setKnocking] = useState(false);

  useEffect(() => {
    if (!profile.expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [profile.expiresAt]);

  const isActive =
    profile.lastKnockStatus === "success" &&
    profile.expiresAt !== null &&
    profile.expiresAt > now;
  const isError = profile.lastKnockStatus === "error";

  const onKnock = async () => {
    setKnocking(true);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await knockOne(profile.id);
    } finally {
      setKnocking(false);
    }
  };

  const onOpen = () => router.push(`/profile/${profile.id}`);
  const disabled = !profile.endpointUrl || !profile.apiKey;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 20, 120))
        .duration(motion.duration.medium)
        .easing(motion.easing.standard)}
      layout={LinearTransition.duration(motion.duration.short).easing(
        motion.easing.standard,
      )}
    >
      <AnimatedPressable
        onPress={onOpen}
        scaleTo={0.98}
        style={[styles.card, { backgroundColor: colors.surface }]}
      >
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {profile.name || "Untitled profile"}
            </Text>
            {profile.pinnedToHome ? (
              <Feather name="bookmark" size={11} color={colors.primary} />
            ) : null}
            {profile.autoRenew ? (
              <Feather name="zap" size={11} color={colors.primary} />
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Feather name="globe" size={10} color={colors.mutedForeground} />
            <Text
              style={[styles.meta, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {formatHostname(profile.endpointUrl) || "no endpoint"}
            </Text>
          </View>
          <View style={styles.statusRow}>
            {isActive ? (
              <>
                <Feather name="check-circle" size={13} color={colors.success} />
                <Text style={[styles.statusText, { color: colors.success }]}>
                  Whitelisted
                </Text>
                <Text style={[styles.dot, { color: colors.border }]}>·</Text>
                <Text
                  style={[
                    styles.statusText,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  {formatCountdown(profile.expiresAt, now)}
                </Text>
              </>
            ) : isError ? (
              <>
                <Feather
                  name="alert-circle"
                  size={13}
                  color={colors.destructive}
                />
                <Text
                  style={[styles.statusText, { color: colors.destructive }]}
                  numberOfLines={1}
                >
                  {profile.lastError || "Failed"}
                </Text>
              </>
            ) : (
              <>
                <Feather
                  name="clock"
                  size={13}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.statusText, { color: colors.mutedForeground }]}
                >
                  Idle
                </Text>
              </>
            )}
          </View>
        </View>

        <AnimatedPressable
          onPress={onKnock}
          disabled={knocking || disabled}
          hitSlop={8}
          scaleTo={0.94}
          style={[
            styles.knockBtn,
            {
              backgroundColor: colors.primary,
              opacity: disabled ? 0.4 : 1,
            },
          ]}
        >
          <Feather name="zap" size={20} color={colors.primaryForeground} />
        </AnimatedPressable>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", flexShrink: 1 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  dot: { fontSize: 12 },
  knockBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
