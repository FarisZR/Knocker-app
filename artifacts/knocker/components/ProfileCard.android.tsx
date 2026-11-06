import { isWhitelisted, grantRemainingFraction } from "@/lib/profileStatus";
import { compareGrantAddress } from "@/lib/publicIp";
import { useNetworkStatus } from "@/context/NetworkContext";
import React, { useEffect, useState, useRef } from "react";
import { useColorScheme, View, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import {
  Host,
  Surface,
  Column,
  Row,
  Box,
  Text,
  Button,
  Shape,
  LoadingIndicator,
  LinearWavyProgressIndicator,
  CircularProgressIndicator,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
  weight,
  semantics,
  clip,
  Shapes,
  background,
  size,
  height,
  graphicsLayer,
  animated,
  spring,
} from "@expo/ui/jetpack-compose/modifiers";
import { useColors } from "@/hooks/useColors";
import { useProfiles } from "@/context/ProfilesContext";
import { formatCountdown, formatHostname } from "@/lib/format";
import { performKnockHaptic } from "@/lib/haptics";
import type { Profile } from "@/lib/profiles";

/** Renders native profile actions, shared request feedback and the draining grant ring without entrance delays. */
export function ProfileCard({
  profile,
  index = 0,
  count = 1,
  selected = false,
  onOpen,
}: {
  profile: Profile;
  index?: number;
  count?: number;
  selected?: boolean;
  onOpen?: (id: string) => void;
}) {
  const router = useRouter();
  const colors = useColors();
  const c = useMaterialColors();
  const dark = useColorScheme() === "dark";
  const reduceMotion = useReducedMotion();
  const { knockOne, pendingKnocks } = useProfiles();
  const { connection, checksEnabled, checking, addresses } = useNetworkStatus();
  const knocking = pendingKnocks.has(profile.id);
  const [now, setNow] = useState(Date.now());
  const [pulse, setPulse] = useState(false);
  const previousAttempt = useRef(profile.lastKnockAt);
  useEffect(() => {
    setNow(Date.now());
    if (!profile.expiresAt) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [profile.expiresAt]);
  useEffect(() => {
    if (previousAttempt.current === profile.lastKnockAt) return;
    previousAttempt.current = profile.lastKnockAt;
    if (!profile.lastKnockAt || Date.now() - profile.lastKnockAt > 2500) return;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 1100);
    return () => clearTimeout(timer);
  }, [profile.lastKnockAt]);
  const active = isWhitelisted(profile, now);
  const remaining = grantRemainingFraction(profile, now);
  const addressMatch = profile.ipOverride
    ? "unknown"
    : compareGrantAddress(profile.whitelistedEntry, addresses);
  const connectionChanged =
    !!profile.grantNetworkId &&
    !!connection?.id &&
    profile.grantNetworkId !== connection.id;
  const ipChanged = active && addressMatch === "changed";
  const networkWarning =
    active &&
    !profile.ipOverride &&
    connectionChanged &&
    addressMatch !== "same";
  const networkNote = profile.ipOverride
    ? "Custom IP target"
    : connection?.isConnected === false
      ? "Offline · reconnect to knock"
      : ipChanged
        ? "IP changed · knock to whitelist this connection"
        : addressMatch === "same"
          ? "Current IP matches"
          : networkWarning
            ? "Network changed · IP may have changed"
            : checking
              ? "Checking current IP…"
              : checksEnabled
                ? "Current IP unavailable"
                : `Knocked on ${profile.grantNetworkType ?? "this connection"} · IP checks off`;
  const failed = profile.lastKnockStatus === "error";
  const greenContainer = dark ? "#153B28" : "#C9F2D8";
  const greenContent = dark ? "#B5F0CB" : "#074D2B";
  // Keep an existing permission green during renewal. Every other state uses
  // the content role paired with its actual container, including dynamic colors.
  const fill = active
    ? greenContainer
    : knocking
      ? c.primaryContainer
      : selected
        ? c.secondaryContainer
        : c.surfaceContainer;
  const content = active
    ? greenContent
    : knocking
      ? c.onPrimaryContainer
      : selected
        ? c.onSecondaryContainer
        : c.onSurface;
  const supportingContent =
    active || knocking || selected ? content : c.onSurfaceVariant;
  const statusFill = active
    ? colors.success
    : failed
      ? c.errorContainer
      : c.secondaryContainer;
  const statusText = active
    ? colors.onSuccess
    : failed
      ? c.onErrorContainer
      : c.onSecondaryContainer;
  /** Opens this profile through the embedded editor callback or the current route instance. */
  const open = () =>
    onOpen ? onOpen(profile.id) : router.push(`/profile/${profile.id}`);
  const spatial = spring({ dampingRatio: 0.72, stiffness: 450 });
  const corners = {
    topStart: index === 0 ? 28 : 8,
    topEnd: index === 0 ? 28 : 8,
    bottomStart: index === count - 1 ? 28 : 8,
    bottomEnd: index === count - 1 ? 28 : 8,
  };
  return (
    <View>
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Surface
          color={fill}
          contentColor={content}
          shape={Shape.RoundedCorner({ cornerRadii: corners })}
          onClick={open}
          selected={selected}
          modifiers={[
            fillMaxWidth(),
            semantics({ contentDescription: `Edit ${profile.name}` }),
            graphicsLayer({
              scaleX: reduceMotion ? 1 : animated(pulse ? 1.012 : 1, spatial),
              scaleY: reduceMotion ? 1 : animated(pulse ? 1.012 : 1, spatial),
            }),
          ]}
        >
          <Column
            modifiers={[fillMaxWidth(), padding(16, 18, 16, 16)]}
            verticalArrangement={{ spacedBy: 12 }}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth()]}
            >
              <Box
                contentAlignment="center"
                modifiers={[
                  size(52, 52),
                  graphicsLayer({
                    rotationZ:
                      reduceMotion || active
                        ? 0
                        : animated(pulse ? -16 : 0, spatial),
                  }),
                  clip(
                    active
                      ? Shapes.Circle
                      : failed
                        ? Shapes.RoundedCorner(18)
                        : Shapes.Material.Cookie4Sided,
                  ),
                  background(
                    active
                      ? greenContainer
                      : failed && !knocking
                        ? c.errorContainer
                        : c.primaryContainer,
                  ),
                ]}
              >
                {knocking ? (
                  <LoadingIndicator
                    color={active ? greenContent : c.onPrimaryContainer}
                    modifiers={[size(44, 44)]}
                  />
                ) : active ? (
                  <CircularProgressIndicator
                    progress={remaining ?? 1}
                    color={colors.success}
                    trackColor={dark ? "#315B41" : "#A7D5B8"}
                    strokeWidth={5}
                    modifiers={[
                      size(52, 52),
                      semantics({
                        contentDescription: `${formatCountdown(profile.expiresAt, now)} of whitelist time remaining${remaining === null ? "" : `, ${Math.ceil(remaining * 100)} percent`}`,
                      }),
                    ]}
                  />
                ) : (
                  <Text
                    color={
                      active
                        ? colors.onSuccess
                        : failed
                          ? c.onErrorContainer
                          : c.onPrimaryContainer
                    }
                    style={{
                      fontSize: active || failed ? 28 : 24,
                      fontWeight: "600",
                    }}
                  >
                    {failed ? "!" : (profile.name[0] || "K").toUpperCase()}
                  </Text>
                )}
              </Box>
              <Column
                modifiers={[weight(1)]}
                verticalArrangement={{ spacedBy: 3 }}
              >
                <Text
                  style={{
                    typography: "titleMedium",
                    fontWeight: "600",
                    fontSize: 20,
                  }}
                  maxLines={1}
                  overflow="ellipsis"
                  color={content}
                >
                  {profile.name || "Untitled profile"}
                </Text>
                <Text
                  style={{ typography: "bodyMedium" }}
                  maxLines={1}
                  overflow="ellipsis"
                  color={supportingContent}
                >
                  {formatHostname(profile.endpointUrl) || "No endpoint"}
                </Text>
              </Column>
              <Button
                enabled={!knocking && !!profile.endpointUrl && !!profile.apiKey}
                onClick={() => {
                  performKnockHaptic();
                  void knockOne(profile.id);
                }}
                shape={Shape.RoundedCorner({
                  cornerRadii: {
                    topStart: 18,
                    topEnd: 18,
                    bottomStart: 18,
                    bottomEnd: 18,
                  },
                })}
                colors={{
                  containerColor: active ? colors.success : c.primary,
                  contentColor: active ? colors.onSuccess : c.onPrimary,
                  ...(knocking
                    ? {
                        disabledContainerColor: active
                          ? colors.success
                          : c.primary,
                        disabledContentColor: active
                          ? colors.onSuccess
                          : c.onPrimary,
                      }
                    : {}),
                }}
                contentPadding={{ start: 18, end: 18, top: 16, bottom: 16 }}
                modifiers={[
                  semantics({ contentDescription: `Knock ${profile.name}` }),
                ]}
              >
                <Text>
                  {knocking
                    ? "Knocking"
                    : ipChanged || networkWarning
                      ? "Update IP"
                      : active
                        ? "Renew"
                        : "Knock"}
                </Text>
              </Button>
            </Row>
            <Row
              horizontalArrangement="spaceBetween"
              verticalAlignment="center"
              modifiers={[fillMaxWidth()]}
            >
              <Box
                modifiers={[
                  clip(Shapes.RoundedCorner(12)),
                  background(knocking ? c.primary : statusFill),
                  padding(10, 5, 10, 5),
                ]}
              >
                <Text
                  color={knocking ? c.onPrimary : statusText}
                  style={{ typography: "labelMedium", fontWeight: "600" }}
                >
                  {knocking
                    ? "Connecting…"
                    : active
                      ? `${ipChanged ? "Previous IP" : "Whitelisted"} · ${formatCountdown(profile.expiresAt, now)}`
                      : failed
                        ? `Not connected · ${profile.lastError || "Try again"}`
                        : "Ready to connect"}
                </Text>
              </Box>
              <Text
                style={{ typography: "labelSmall" }}
                color={
                  active && failed && !knocking ? c.error : supportingContent
                }
              >
                {[
                  active && failed ? "Renewal failed" : "",
                  profile.pinnedToHome ? "Pinned" : "",
                  profile.autoRenew ? "Auto-renew" : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Row>
            {profile.whitelistedEntry ? (
              <Column
                verticalArrangement={{ spacedBy: 4 }}
                modifiers={[fillMaxWidth()]}
              >
                <Text
                  style={{ typography: "bodyMedium", fontWeight: "600" }}
                  color={content}
                >
                  {active ? "Whitelisted IP" : "Last whitelisted IP"} ·{" "}
                  {profile.whitelistedEntry}
                </Text>
                {active ? (
                  <Text
                    style={{ typography: "bodySmall" }}
                    color={
                      (ipChanged || networkWarning) && !knocking
                        ? c.error
                        : supportingContent
                    }
                  >
                    {networkNote}
                  </Text>
                ) : null}
              </Column>
            ) : null}
            <Box modifiers={[fillMaxWidth(), height(4)]}>
              {knocking ? (
                <LinearWavyProgressIndicator
                  color={content}
                  modifiers={[fillMaxWidth(), height(4)]}
                />
              ) : null}
            </Box>
          </Column>
        </Surface>
      </Host>
    </View>
  );
}
