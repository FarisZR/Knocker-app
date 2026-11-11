import { isDiagnosticsEnabled, startLaunchKnocks } from "knocker-native";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import Feather from "@expo/vector-icons/Feather";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProfilesProvider } from "@/context/ProfilesContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { useColors } from "@/hooks/useColors";

// Crash reporting honors the in-app choice before anything starts. The native
// SDK does not auto-initialize (io.sentry.auto-init is false), so skipping init
// means no Sentry code runs and nothing is sent. Settings changes persist the
// choice; turning reporting on applies on the next launch.
if (isDiagnosticsEnabled()) {
  Sentry.init({
    dsn: "https://e7a4df6605d189adfbee103c2dcba868@o4511192693014528.ingest.de.sentry.io/4511882460069969",

    // Keep request and user context opt-in because the app handles profile data.
    // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: false,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? "development" : "production"),

    // Keep log collection disabled because console output may contain user data.
    enableLogs: false,
    // No user feedback widget: the app has no UI that collects free-text reports.
    integrations: [Sentry.expoRouterIntegration()],

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
  });
}

// Navigation uses useRouter() within mounted screens. SDK 58 resets its global
// imperative router during activity recreation, so do not wrap that singleton.
void SplashScreen.preventAutoHideAsync();

function reportErrorBoundaryError(error: Error, componentStack: string): void {
  Sentry.withScope((scope) => {
    scope.setExtra("componentStack", componentStack);
    Sentry.captureException(error);
  });
}

const queryClient = new QueryClient();

/** Keeps route navigation available while optional startup work runs separately. */
function RootLayoutNav() {
  const colors = useColors();
  if (Platform.OS === "android") return <Slot />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: "Inter_600SemiBold",
        },
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile/[id]"
        options={{
          presentation: "modal",
          title: "Profile",
        }}
      />
    </Stack>
  );
}

function StartupReadyController() {
  useEffect(() => {
    let knockFrame: number | null = null;
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
      // Begin the cached native batch on the next frame, without awaiting JS
      // profile/key hydration, animations, font loading or connection checks.
      knockFrame = requestAnimationFrame(startLaunchKnocks);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (knockFrame !== null) cancelAnimationFrame(knockFrame);
    };
  }, []);

  return null;
}

function FallbackFonts() {
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });
  return null;
}

function RootLayout() {
  const Container =
    Platform.OS === "android" ? React.Fragment : GestureHandlerRootView;
  const KeyboardContainer =
    Platform.OS === "android" ? React.Fragment : KeyboardProvider;

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={reportErrorBoundaryError}>
        <QueryClientProvider client={queryClient}>
          <Container>
            <KeyboardContainer>
              {Platform.OS !== "android" ? <FallbackFonts /> : null}
              {/*
                Load fonts and profiles in the background, but hide the splash
                as soon as the first frame is ready so startup stays responsive.
              */}
              <ProfilesProvider>
                <NetworkProvider>
                  <StartupReadyController />
                  <StatusBar style="auto" />
                  <RootLayoutNav />
                </NetworkProvider>
              </ProfilesProvider>
            </KeyboardContainer>
          </Container>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
