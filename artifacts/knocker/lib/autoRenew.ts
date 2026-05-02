import type { Profile } from "./profiles";

type Timer = ReturnType<typeof setTimeout>;

const timers = new Map<string, Timer>();
const MAX_DELAY_MS = 2_147_000_000;

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
}
