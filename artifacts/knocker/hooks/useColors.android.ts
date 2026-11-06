import { useColorScheme } from "react-native";
import { useMaterialColors } from "@expo/ui/jetpack-compose";

/** Share the device's Material You palette with the React Native shell. */
export function useColors() {
  const c = useMaterialColors();
  const dark = useColorScheme() === "dark";
  return {
    text: c.onSurface,
    tint: c.primary,
    background: c.surface,
    foreground: c.onSurface,
    card: c.surfaceContainer,
    cardForeground: c.onSurface,
    primary: c.primary,
    primaryForeground: c.onPrimary,
    primaryContainer: c.primaryContainer,
    onPrimaryContainer: c.onPrimaryContainer,
    secondary: c.secondaryContainer,
    secondaryForeground: c.onSecondaryContainer,
    muted: c.surfaceContainerHigh,
    mutedForeground: c.onSurfaceVariant,
    accent: c.secondaryContainer,
    accentForeground: c.onSecondaryContainer,
    onSurfaceVariant: c.onSurfaceVariant,
    destructive: c.error,
    destructiveForeground: c.onError,
    success: dark ? "#91D5AC" : "#146C43",
    onSuccess: dark ? "#00391C" : "#FFFFFF",
    border: c.outline,
    borderVariant: c.outlineVariant,
    input: c.outline,
    surface: c.surfaceContainer,
    radius: 24,
  };
}
