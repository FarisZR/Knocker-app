import React, { useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { snackbarBottom } from "@/lib/homeActionsLayout";
import {
  Host,
  Surface,
  Column,
  Row,
  Text,
  TextButton,
  Shape,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
  semantics,
} from "@expo/ui/jetpack-compose/modifiers";
import { useProfiles } from "@/context/ProfilesContext";

/** Explicit native actions keep retry reliable and visible until acted upon. */
export function Snackbar({ bottomOffset }: { bottomOffset: number }) {
  const { snackbar, dismissSnackbar } = useProfiles();
  const c = useMaterialColors();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => {
    if (!snackbar || snackbar.persistent || snackbar.retry) return;
    const timer = setTimeout(dismissSnackbar, 4500);
    return () => clearTimeout(timer);
  }, [snackbar, dismissSnackbar]);
  if (!snackbar) return null;
  return (
    <View
      key={snackbar.id}
      accessible={false}
      collapsable={false}
      importantForAccessibility="no"
      onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: snackbarBottom(bottomOffset, height, insets.top, contentHeight),
      }}
    >
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Surface
          color={c.inverseSurface}
          contentColor={c.inverseOnSurface}
          shadowElevation={6}
          shape={Shape.RoundedCorner({
            cornerRadii: {
              topStart: 24,
              topEnd: 24,
              bottomStart: 24,
              bottomEnd: 24,
            },
          })}
        >
          <Column
            modifiers={[fillMaxWidth(), padding(20, 16, 12, 8)]}
            verticalArrangement={{ spacedBy: 4 }}
          >
            <Text
              maxLines={2}
              overflow="ellipsis"
              style={{ typography: "titleSmall" }}
            >{`${snackbar.tone === "success" ? "✓ " : snackbar.tone === "error" ? "! " : ""}${snackbar.text}`}</Text>
            {snackbar.detail ? (
              <Text
                maxLines={3}
                overflow="ellipsis"
                style={{ typography: "bodyMedium" }}
              >
                {snackbar.detail}
              </Text>
            ) : null}
            <Row horizontalArrangement="end" modifiers={[fillMaxWidth()]}>
              <TextButton
                onClick={dismissSnackbar}
                colors={{ contentColor: c.inversePrimary }}
                modifiers={[
                  semantics({ contentDescription: "Dismiss feedback" }),
                ]}
              >
                <Text>Dismiss</Text>
              </TextButton>
              {snackbar.retry ? (
                <TextButton
                  onClick={() => {
                    const retry = snackbar.retry;
                    dismissSnackbar();
                    retry?.();
                  }}
                  colors={{ contentColor: c.inversePrimary }}
                  modifiers={[semantics({ contentDescription: "Retry knock" })]}
                >
                  <Text>Retry</Text>
                </TextButton>
              ) : null}
            </Row>
          </Column>
        </Surface>
      </Host>
    </View>
  );
}
