import { Platform } from "react-native";

import {
  cancelAllRenewals as nativeCancelAll,
  isNativeAvailable,
  scheduleRenewal as nativeSchedule,
} from "knocker-native";

import type { Profile } from "./profiles";

type Timer = ReturnType<typeof setTimeout>;

const timers = new Map<string, Timer>();
const MAX_DELAY_MS = 2_147_000_000;

/**
 * Schedule a renewal callback for every auto-renew profile.
 *
 * On Android dev/prod builds the native module is preferred: it uses
 * `AlarmManager.setExactAndAllowWhileIdle` so the renewal still fires when the
 * app is killed. The JS-side `setTimeout` fallback only works while the JS
 * runtime is alive (Expo Go, web, foreground app).
 *
 * `fire` is invoked when a renewal triggers in JS. The native side handles its
 * own renewal HTTP call independently and persists the new expiry — when the
 * app comes back to the foreground the JS state syncs from the native store.
 */
export function scheduleRenewals(
  profiles: Profile[],
  fire: (profileId: string) => void,
): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();

  const nativeOn = isNativeAvailable && Platform.OS === "android";

  const now = Date.now();
  for (const p of profiles) {
    if (!p.autoRenew || !p.expiresAt) continue;
    const safety = (p.autoRenewSafetyWindowSec ?? 300) * 1000;
    const fireAt = p.expiresAt - safety;

    if (nativeOn) {
      // Native path: schedule via AlarmManager. Survives app close.
      void nativeSchedule(p.id, fireAt);
      continue;
    }

    const delay = fireAt - now;
    if (delay <= 0) {
      fire(p.id);
      continue;
    }
    if (delay > MAX_DELAY_MS) continue;
    const timer = setTimeout(() => {
      timers.delete(p.id);
      fire(p.id);
    }, delay);
    timers.set(p.id, timer);
  }
}

export function clearAllRenewals(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  if (isNativeAvailable && Platform.OS === "android") {
    void nativeCancelAll();
  }
}
