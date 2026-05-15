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
import React, { useEffect } from "react";
import {
  InteractionManager,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProfilesProvider } from "@/context/ProfilesContext";
import { useColors } from "@/hooks/useColors";

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

export default function RootLayout() {
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
