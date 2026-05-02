/**
 * In-app foreground auto-renew scheduler.
 *
 * Limitation: this only fires while the app is in the foreground. True
 * background auto-renew across app kills requires the native AlarmManager
 * exact-alarm module (see modules/knocker-native/, dev-client build only).
 *
 * For each profile with autoRenew=true and expiresAt set, schedules a
 * single setTimeout to fire (expiresAt - safetyWindow) and trigger the
 * provided callback. Timers are reset every time schedule() is called.
 */

import type { Profile } from "./profiles";

type Timer = ReturnType<typeof setTimeout>;

const timers = new Map<string, Timer>();

export function scheduleRenewals(
  profiles: Profile[],
  fire: (profileId: string) => void,
): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();

  const now = Date.now();
  for (const p of profiles) {
    if (!p.autoRenew || !p.expiresAt) continue;
    const safety = (p.autoRenewSafetyWindowSec ?? 300) * 1000;
    const fireAt = p.expiresAt - safety;
    const delay = fireAt - now;
    if (delay <= 0) {
      fire(p.id);
      continue;
    }
    const cap = 2_147_000_000;
    if (delay > cap) continue;
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
}
