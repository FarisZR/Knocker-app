import { isWhitelisted } from "@/lib/profileStatus";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useColors } from "@/hooks/useColors";
import { useProfiles } from "@/context/ProfilesContext";
import { motion } from "@/constants/motion";
import { formatCountdown, formatHostname } from "@/lib/format";
import { performKnockHaptic } from "@/lib/haptics";
import { useNetworkStatus } from "@/context/NetworkContext";
import type { Profile } from "@/lib/profiles";

/** Provides the cross-platform profile fallback with shared pending and renewal-error feedback. */
export function ProfileCard({
  profile,
  index = 0,
  selected = false,
  onOpen,
}: {
  profile: Profile;
  index?: number;
  count?: number;
  selected?: boolean;
  onOpen?: (profileId: string) => void;
}) {
  const router = useRouter();
  const colors = useColors();
  const { knockOne, pendingKnocks } = useProfiles();
  const network = useNetworkStatus();
  const observation = network.statuses[profile.id];
  const expiresAt = observation?.whitelisted
    ? observation.expiresAt
    : profile.expiresAt;
  const [now, setNow] = useState(Date.now());
  const knocking = pendingKnocks.has(profile.id);

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const isActive = isWhitelisted({ expiresAt }, now);
  const isError = profile.lastKnockStatus === "error";

  const onKnock = async () => {
    performKnockHaptic();
    await knockOne(profile.id);
  };

  /** Uses the embedded selection handler when supplied, otherwise the current router. */
  const openProfile = () => {
    if (onOpen) {
      onOpen(profile.id);
      return;
    }
    router.push(`/profile/${profile.id}`);
  };
  const disabled = !profile.endpointUrl || !profile.apiKey;

  return (
    <Animated.View
      layout={LinearTransition.duration(motion.duration.short).easing(
        motion.easing.standard,
      )}
    >
      <AnimatedPressable
        onPress={openProfile}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[
          styles.card,
          {
            backgroundColor: selected
              ? colors.primaryContainer
              : colors.surface,
            borderColor: selected ? colors.primary : "transparent",
          },
        ]}
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
            {knocking ? (
              <Text style={[styles.statusText, { color: colors.primary }]}>
                Knocking…
              </Text>
            ) : isActive ? (
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
                  {formatCountdown(expiresAt, now)}
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
          {!profile.ipOverride && observation && !observation.whitelisted ? (
            <View
              style={{
                backgroundColor: colors.primaryContainer,
                padding: 10,
                borderRadius: 10,
                marginTop: 8,
              }}
            >
              <Text style={{ color: colors.onPrimaryContainer }}>
                Current IP is not whitelisted
              </Text>
              <Text style={{ color: colors.onPrimaryContainer }}>
                Current IP · {observation.ipAddress}
              </Text>
              {profile.whitelistedEntry ? (
                <Text style={{ color: colors.onPrimaryContainer }}>
                  Last knock · {profile.whitelistedEntry}
                </Text>
              ) : null}
            </View>
          ) : null}
          {isActive && isError ? (
            <Text
              style={[
                styles.statusText,
                { color: colors.destructive, marginTop: 6 },
              ]}
            >
              Renewal failed · {profile.lastError || "Try again"}
            </Text>
          ) : null}
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
    borderWidth: 1,
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
