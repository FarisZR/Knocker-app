import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedPressable } from "@/components/AnimatedPressable";
import { DevBuildBanner } from "@/components/DevBuildBanner";
import { ProfileCard } from "@/components/ProfileCard";
import { Snackbar } from "@/components/Snackbar";
import { useColors } from "@/hooks/useColors";
import { useProfiles } from "@/context/ProfilesContext";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profiles, loaded, knockOne, knockAll } = useProfiles();

  const activeCount = useMemo(() => {
    const now = Date.now();
    return profiles.filter(
      (p) =>
        p.lastKnockStatus === "success" &&
        p.expiresAt !== null &&
        p.expiresAt > now,
    ).length;
  }, [profiles]);

  const pinned = profiles.filter((p) => p.pinnedToHome);
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 12;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const haptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== "web") void Haptics.impactAsync(style);
  };

  const onNew = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    router.push("/profile/new");
  };
  const onKnockAll = () => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    void knockAll();
  };
  const onKnockPinned = (id: string) => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    void knockOne(id);
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topPad },
      ]}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        style={styles.header}
      >
        <Text style={[styles.kicker, { color: colors.mutedForeground }]}>
          {profiles.length === 0
            ? "No profiles yet"
            : `${profiles.length} profile${profiles.length === 1 ? "" : "s"} · ${activeCount} active`}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Knocker</Text>
      </Animated.View>

      <DevBuildBanner />

      {!loaded ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.mutedForeground }}>Loading…</Text>
        </View>
      ) : profiles.length === 0 ? (
        <Animated.View
          entering={FadeIn.duration(400).delay(100)}
          style={styles.empty}
        >
          <Feather name="zap" size={48} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Add your first profile
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Set the endpoint URL and API key for your Caddy Knocker server.
            We'll handle the rest.
          </Text>
          <AnimatedPressable
            onPress={onNew}
            scaleTo={0.94}
            style={[styles.emptyCta, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text
              style={[styles.emptyCtaText, { color: colors.primaryForeground }]}
            >
              New profile
            </Text>
          </AnimatedPressable>
        </Animated.View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <ProfileCard profile={item} index={index} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: bottomPad + 220,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {profiles.length > 0 ? (
        <View
          style={[styles.fabStack, { right: 16, bottom: bottomPad + 16 }]}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={FadeInDown.delay(60).duration(280).springify().damping(16)}
          >
            <AnimatedPressable
              onPress={onNew}
              scaleTo={0.93}
              style={[styles.fabSecondary, { borderColor: colors.border }]}
            >
              <Feather name="plus" size={16} color={colors.onSurfaceVariant} />
              <Text
                style={[styles.fabSecondaryText, { color: colors.onSurfaceVariant }]}
              >
                New profile
              </Text>
            </AnimatedPressable>
          </Animated.View>

          {pinned.map((p, i) => (
            <Animated.View
              key={p.id}
              entering={FadeInDown.delay(100 + i * 60)
                .duration(300)
                .springify()
                .damping(16)}
            >
              <AnimatedPressable
                onPress={() => onKnockPinned(p.id)}
                scaleTo={0.92}
                style={[
                  styles.fabPinned,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Feather
                  name="bookmark"
                  size={13}
                  color={colors.onPrimaryContainer}
                />
                <Feather
                  name="zap"
                  size={16}
                  color={colors.onPrimaryContainer}
                />
                <Text
                  style={[
                    styles.fabPinnedText,
                    { color: colors.onPrimaryContainer },
                  ]}
                  numberOfLines={1}
                >
                  Knock {p.name || "profile"}
                </Text>
              </AnimatedPressable>
            </Animated.View>
          ))}

          <Animated.View
            entering={FadeInDown.delay(140 + pinned.length * 60)
              .duration(320)
              .springify()
              .damping(15)}
          >
            <AnimatedPressable
              onPress={onKnockAll}
              scaleTo={0.94}
              style={[styles.fabPrimary, { backgroundColor: colors.primary }]}
            >
              <Feather name="zap" size={22} color={colors.primaryForeground} />
              <Text
                style={[styles.fabPrimaryText, { color: colors.primaryForeground }]}
              >
                Knock all
              </Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      ) : null}

      <Snackbar bottomOffset={bottomPad + 220} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  kicker: { fontSize: 13, fontFamily: "Inter_500Medium" },
  title: {
    fontSize: 32,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    letterSpacing: -0.5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 22,
    marginTop: 12,
  },
  emptyCtaText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  fabStack: {
    position: "absolute",
    alignItems: "flex-end",
    gap: 12,
  },
  fabSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  fabSecondaryText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  fabPinned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 18,
    maxWidth: 280,
  },
  fabPinnedText: { fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  fabPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 26,
    paddingVertical: 18,
    borderRadius: 22,
  },
  fabPrimaryText: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
});
