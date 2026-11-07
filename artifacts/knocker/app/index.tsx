import { isWhitelisted } from "@/lib/profileStatus";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ProfileCard } from "@/components/ProfileCard";
import { Snackbar } from "@/components/Snackbar";
import { motion } from "@/constants/motion";
import { useColors } from "@/hooks/useColors";
import { useAdaptiveLayout } from "@/hooks/useAdaptiveLayout";
import { useProfiles } from "@/context/ProfilesContext";
import { performKnockHaptic, performTapHaptic } from "@/lib/haptics";

/** Shows saved profiles immediately and adapts editing and actions to the available panes. */
export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profiles, loaded, knockOne, knockAll } = useProfiles();
  const { profile: profileParam } = useLocalSearchParams<{
    profile?: string;
  }>();
  const { showTwoPanes, widthClass, width, height } = useAdaptiveLayout();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    profileParam ?? null,
  );
  const [editorDirty, setEditorDirty] = useState(false);
  const previousProfileIdRef = useRef<string | null>(null);

  const [statusNow, setStatusNow] = useState(Date.now());
  useEffect(() => {
    if (!profiles.some((profile) => profile.expiresAt)) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setStatusNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [profiles]);
  const activeCount = useMemo(() => {
    const now = statusNow;
    return profiles.filter((p) => isWhitelisted(p, now)).length;
  }, [profiles, statusNow]);

  const pinned = profiles.filter((p) => p.pinnedToHome);
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 12;
  const bottomPad = isWeb ? 34 : insets.bottom;

  useEffect(() => {
    if (!showTwoPanes || !profileParam) return;
    setSelectedProfileId(profileParam);
  }, [profileParam, showTwoPanes]);

  useEffect(() => {
    if (!loaded || !showTwoPanes) return;
    if (selectedProfileId === "new") return;
    if (
      selectedProfileId &&
      profiles.some((profile) => profile.id === selectedProfileId)
    ) {
      return;
    }
    setSelectedProfileId(profiles[0]?.id ?? "new");
  }, [loaded, profiles, selectedProfileId, showTwoPanes]);

  useEffect(() => {
    if (selectedProfileId && selectedProfileId !== "new") {
      previousProfileIdRef.current = selectedProfileId;
    }
  }, [selectedProfileId]);

  const commitSelection = useCallback((profileId: string | null) => {
    setEditorDirty(false);
    setSelectedProfileId(profileId);
  }, []);

  /** Switches embedded profiles only after unsaved changes are handled. */
  const requestSelection = useCallback(
    (profileId: string | null) => {
      if (profileId === selectedProfileId) return;
      if (!editorDirty) {
        commitSelection(profileId);
        return;
      }

      const discard = () => commitSelection(profileId);
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        if (
          typeof window !== "undefined" &&
          window.confirm("Discard unsaved changes?")
        ) {
          discard();
        }
        return;
      }

      Alert.alert(
        "Discard unsaved changes?",
        "Your changes to this profile have not been saved.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: discard },
        ],
      );
    },
    [commitSelection, editorDirty, selectedProfileId],
  );

  /** Opens a new draft in the detail pane or the compact editor route. */
  const onNew = () => {
    performTapHaptic();
    if (showTwoPanes) {
      requestSelection("new");
      return;
    }
    router.push("/profile/new");
  };
  const onKnockAll = () => {
    performKnockHaptic();
    void knockAll();
  };
  const onKnockPinned = (id: string) => {
    performKnockHaptic();
    void knockOne(id);
  };

  /** Uses embedded editing on wide windows and a modal route on compact windows. */
  const onOpenProfile = (profileId: string) => {
    if (showTwoPanes) {
      requestSelection(profileId);
      return;
    }
    router.push(`/profile/${profileId}`);
  };

  /** Selects a surviving profile after deleting the current embedded draft. */
  const onEditorDeleted = (profileId: string) => {
    const remaining = profiles.filter((profile) => profile.id !== profileId);
    commitSelection(remaining[0]?.id ?? "new");
  };

  /** Returns a cancelled new draft to the prior saved profile when possible. */
  const onEditorCancel = () => {
    if (!showTwoPanes) {
      commitSelection(null);
      return;
    }
    if (selectedProfileId !== "new") return;
    const previous = previousProfileIdRef.current;
    commitSelection(
      previous && profiles.some((profile) => profile.id === previous)
        ? previous
        : (profiles[0]?.id ?? "new"),
    );
  };

  const showListPane = showTwoPanes || selectedProfileId === null;
  const showDetailPane = selectedProfileId !== null;
  const floatingActionBottom =
    bottomPad + 16 + (showTwoPanes && editorDirty ? 76 : 0);
  const actionClearance = bottomPad + 220;
  const animatedFloatingActionBottom = useSharedValue(floatingActionBottom);
  useEffect(() => {
    animatedFloatingActionBottom.value = withTiming(floatingActionBottom, {
      duration: motion.duration.medium,
      easing: motion.easing.standard,
    });
  }, [animatedFloatingActionBottom, floatingActionBottom]);
  const floatingActionStyle = useAnimatedStyle(() => ({
    bottom: animatedFloatingActionBottom.value,
  }));
  const floatingActions = !loaded ? null : profiles.length > 0 ? (
    <Animated.View
      style={[styles.fabStack, { right: 16 }, floatingActionStyle]}
      pointerEvents="box-none"
    >
      <Animated.View
        entering={FadeInDown.duration(motion.duration.medium).easing(
          motion.easing.standard,
        )}
      >
        <AnimatedPressable
          onPress={onNew}
          scaleTo={0.96}
          style={[
            styles.fabSecondary,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="plus" size={16} color={colors.onSurfaceVariant} />
          <Text
            style={[
              styles.fabSecondaryText,
              { color: colors.onSurfaceVariant },
            ]}
          >
            New profile
          </Text>
        </AnimatedPressable>
      </Animated.View>

      {pinned.map((profile, index) => (
        <Animated.View
          key={profile.id}
          entering={FadeInDown.delay(Math.min(index * 20, 80))
            .duration(motion.duration.medium)
            .easing(motion.easing.standard)}
        >
          <AnimatedPressable
            onPress={() => onKnockPinned(profile.id)}
            scaleTo={0.96}
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
            <Feather name="zap" size={16} color={colors.onPrimaryContainer} />
            <Text
              style={[
                styles.fabPinnedText,
                { color: colors.onPrimaryContainer },
              ]}
              numberOfLines={1}
            >
              Knock {profile.name || "profile"}
            </Text>
          </AnimatedPressable>
        </Animated.View>
      ))}

      <Animated.View
        entering={FadeInDown.delay(Math.min((pinned.length + 1) * 20, 100))
          .duration(motion.duration.medium)
          .easing(motion.easing.standard)}
      >
        <AnimatedPressable
          onPress={onKnockAll}
          scaleTo={0.96}
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
    </Animated.View>
  ) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.adaptiveShell}>
        <View
          style={[
            styles.listPane,
            showTwoPanes
              ? widthClass === "medium"
                ? styles.mediumPane
                : width > height
                  ? styles.expandedLandscapeListPane
                  : styles.expandedListPane
              : styles.singlePane,
            !showListPane ? styles.hiddenPane : null,
            { paddingTop: topPad },
          ]}
        >
          <Animated.View style={styles.header}>
            <Text style={[styles.kicker, { color: colors.mutedForeground }]}>
              {profiles.length === 0
                ? "No profiles yet"
                : `${profiles.length} profile${profiles.length === 1 ? "" : "s"} · ${activeCount} active`}
            </Text>
            <View style={styles.wordmarkFrame}>
              <KnockerWordmark />
            </View>
          </Animated.View>

          {!loaded ? (
            <View style={styles.empty}>
              <Text style={{ color: colors.mutedForeground }}>Loading…</Text>
            </View>
          ) : profiles.length === 0 ? (
            <Animated.View style={styles.empty}>
              <KnockerIcon style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Add your first profile
              </Text>
              <Text
                style={[styles.emptyBody, { color: colors.mutedForeground }]}
              >
                Set the endpoint URL and API key for your Caddy Knocker server.
                We'll handle the rest.
              </Text>
              <AnimatedPressable
                onPress={onNew}
                scaleTo={0.96}
                style={[styles.emptyCta, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Add new profile"
              >
                <Feather
                  name="plus"
                  size={24}
                  color={colors.primaryForeground}
                />
              </AnimatedPressable>
            </Animated.View>
          ) : (
            <FlatList
              data={profiles}
              keyExtractor={(profile) => profile.id}
              renderItem={({ item, index }) => (
                <ProfileCard
                  profile={item}
                  index={index}
                  count={profiles.length}
                  selected={showTwoPanes && item.id === selectedProfileId}
                  onOpen={onOpenProfile}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: actionClearance,
              }}
              showsVerticalScrollIndicator={false}
            />
          )}

          {!showTwoPanes ? floatingActions : null}

          <Snackbar bottomOffset={actionClearance} />
        </View>

        {showTwoPanes ? (
          <View
            style={[
              styles.paneDivider,
              { backgroundColor: colors.borderVariant },
            ]}
          />
        ) : null}

        <View
          style={[
            styles.detailPane,
            !showTwoPanes ? styles.singlePane : null,
            !showDetailPane ? styles.hiddenPane : null,
            { paddingTop: topPad },
          ]}
        >
          {selectedProfileId ? (
            <ProfileEditor
              key={selectedProfileId}
              profileId={selectedProfileId}
              embedded={showTwoPanes}
              onSaved={(profile) => commitSelection(profile.id)}
              onDeleted={onEditorDeleted}
              onCancel={onEditorCancel}
              onDirtyChange={setEditorDirty}
            />
          ) : null}
        </View>
      </View>
      {showTwoPanes ? floatingActions : null}
    </View>
  );
}

function KnockerIcon({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Svg
      width={64}
      height={64}
      viewBox="0 -960 960 960"
      style={style}
      accessibilityRole="image"
      accessibilityLabel="Knocker"
    >
      <Ellipse
        fill="#1a1a1a"
        cx={479.39853}
        cy={-479.3985}
        rx={479.3985}
        ry={478.1955}
      />
      <Path
        fill="#ffffff"
        d="m 764,-172 v -22 h -56 v -563 q 0,-21.5 -16.25,-37.75 Q 675.5,-811 654,-811 H 306 q -21.5,0 -37.75,16.25 Q 252,-778.5 252,-757 v 563 h -56 v 22 z m -404,-22 h -86 v -563 q 0,-14 9,-23 9,-9 23,-9 h 128 v -3 q -32,2 -53,25.7 -21,23.7 -21,55.3 z m 159.81,-261 q -9.81,0 -17.31,-7.69 -7.5,-7.7 -7.5,-17.5 0,-9.81 7.69,-17.31 7.7,-7.5 17.5,-7.5 9.81,0 17.31,7.69 7.5,7.7 7.5,17.5 0,9.81 -7.69,17.31 -7.7,7.5 -17.5,7.5 z"
      />
      <Ellipse
        fill="#fde562"
        cx={518.95984}
        cy={-479.2001}
        rx={28.732313}
        ry={28.63653}
      />
    </Svg>
  );
}

function KnockerWordmark({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <Svg
      width={205}
      height={36}
      viewBox="0 0 204.67189 35.55994"
      style={style}
      accessibilityRole="image"
      accessibilityLabel="Knocker"
    >
      <G transform="translate(-3.5522995,-148.19943)">
        <Path
          fill={colors.foreground}
          d="m 3.5523266,183.75937 v -35.56 h 4.5719999 v 15.494 h 8.3819995 l 9.5504,-15.494 h 5.3848 l -10.668,16.764 11.43,18.796 h -5.2832 l -9.7028,-16.002 H 8.1243265 v 16.002 z m 32.0039554,0 v -28.448 h 20.828 l 4.572,4.572 v 23.876 h -4.572 v -24.384 h -16.256 v 24.384 z m 31.242045,-4.572 v -19.304 l 4.572,-4.572 h 15.747999 l 4.572,4.572 v 19.304 l -4.572,4.572 H 71.370327 Z m 4.572,0.508 h 15.747999 v -20.32 H 71.370327 Z m 25.908018,-0.508 v -19.304 l 4.572005,-4.572 h 18.79599 v 4.064 h -18.79599 v 20.32 h 18.79599 v 4.064 h -18.79599 z m 27.939995,4.572 v -35.56 h 4.572 v 18.7452 h 9.0424 l 7.62,-11.6332 h 5.2324 l -8.9408,13.1064 9.398,15.3416 h -5.1816 l -7.6708,-12.7508 h -9.4996 v 12.7508 z m 29.21001,-4.572 v -19.304 l 4.572,-4.572 h 19.812 v 15.748 h -19.812 v 8.636 h 18.796 v 4.064 h -18.796 z m 4.572,-11.684 15.4432,-0.508 v -7.62 h -15.4432 z m 25.654,16.256 v -23.876 l 4.572,-4.572 h 15.24 v 4.064 h -15.24 v 24.384 z"
        />
        <Circle fill="#fde562" cx={203.30513} cy={157.00136} r={4.9190621} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  adaptiveShell: { flex: 1, flexDirection: "row" },
  listPane: { minWidth: 0 },
  detailPane: { flex: 1, minWidth: 0 },
  mediumPane: { flex: 1 },
  expandedListPane: { width: 360 },
  expandedLandscapeListPane: { width: 420 },
  singlePane: { width: "100%", flex: 1 },
  hiddenPane: { display: "none" },
  paneDivider: { width: StyleSheet.hairlineWidth },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  kicker: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  wordmarkFrame: {
    width: 188,
    height: 33,
    marginTop: 6,
    overflow: "visible",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIcon: { marginBottom: 2 },
  emptyTitle: {
    alignSelf: "stretch",
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
    textAlign: "center",
  },
  emptyBody: {
    alignSelf: "stretch",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emptyCta: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: 12,
  },
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
  fabSecondaryText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  fabPinned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 18,
    maxWidth: 280,
  },
  fabPinnedText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  fabPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 26,
    paddingVertical: 18,
    borderRadius: 22,
  },
  fabPrimaryText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
