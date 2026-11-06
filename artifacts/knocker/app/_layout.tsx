import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import Feather from "@expo/vector-icons/Feather";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import React, { useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProfilesProvider } from "@/context/ProfilesContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { useColors } from "@/hooks/useColors";

Sentry.init({
  dsn: "https://e7a4df6605d189adfbee103c2dcba868@o4511192693014528.ingest.de.sentry.io/4511882460069969",

  // Keep request and user context opt-in because the app handles profile data.
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: false,

  // Keep log collection disabled because console output may contain user data.
  enableLogs: false,
  integrations: [Sentry.expoRouterIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily:
            Platform.OS === "android"
              ? "sans-serif-medium"
              : "Inter_600SemiBold",
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
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}

function RootLayout() {
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (Number(Platform.Version) < 33) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const task = requestIdleCallback(() => {
      timeout = setTimeout(() => {
        void (async () => {
          const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
          const alreadyGranted = await PermissionsAndroid.check(permission);
          if (alreadyGranted) return;

          await PermissionsAndroid.request(permission);
        })();
      }, 750);
    });

    return () => {
      cancelIdleCallback(task);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={reportErrorBoundaryError}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
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
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
