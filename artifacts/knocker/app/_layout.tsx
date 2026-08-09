import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import Feather from "@expo/vector-icons/Feather";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import React, { useEffect } from "react";
import { InteractionManager, PermissionsAndroid, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProfilesProvider } from "@/context/ProfilesContext";
import { useColors } from "@/hooks/useColors";

Sentry.init({
  dsn: "https://e7a4df6605d189adfbee103c2dcba868@o4511192693014528.ingest.de.sentry.io/4511882460069969",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,
  integrations: [Sentry.expoRouterIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Expo Router's static singleton has a narrower prefetch signature than the
// router shape accepted by Sentry's wrapper.
Sentry.wrapExpoRouter(router as unknown as Sentry.ExpoRouter);

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
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
    const task = InteractionManager.runAfterInteractions(() => {
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
      task.cancel();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              {/*
                Load fonts and profiles in the background, but hide the splash
                as soon as the first frame is ready so startup stays responsive.
              */}
              <ProfilesProvider>
                <StartupReadyController />
                <StatusBar style="light" />
                <RootLayoutNav />
              </ProfilesProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
