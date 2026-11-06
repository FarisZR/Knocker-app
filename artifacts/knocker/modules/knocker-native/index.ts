import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

export interface NativeProfileSnapshot {
  id: string;
  name: string;
  endpointUrl: string;
  apiKey: string;
  ttlSeconds: number | null;
  ipOverride: string | null;
  autoRenew: boolean;
  autoRenewSafetyWindowSec: number;
  tileSlot: number | null;
  expiresAt: number | null;
  whitelistedAt: number | null;
  grantRecordedAt: number | null;
  whitelistedEntry: string | null;
  grantNetworkId: string | null;
  grantNetworkType: string | null;
  knockOnOpen: boolean;
  configurationFingerprint: string;
  grantConfigurationFingerprint: string;
}

export interface NativeLaunchKnockResult {
  grantConfigurationFingerprint?: string;
  profileId: string;
  name: string;
  ok: boolean;
  message: string | null;
  whitelistedEntry: string | null;
  expiresInSeconds: number | null;
  expiresAtMillis: number | null;
  requestedTtlSeconds: number | null;
  ttlCapped: boolean;
  configurationFingerprint: string;
  whitelistedAtMillis: number | null;
  grantNetworkId: string | null;
  grantNetworkType: string | null;
  completedAtMillis: number;
}

export interface NativeNetworkIdentity {
  id: string | null;
  type: string;
  isConnected: boolean;
}

interface KnockerNativeAndroid {
  addListener?(
    event: string,
    callback: (event: { profileIds: string[] }) => void,
  ): { remove(): void };
  getPendingKnockIdsJson?(): Promise<string>;
  knockProfileJson?(id: string, configuration: string): Promise<string | null>;
  getNetworkIdentity(): Promise<NativeNetworkIdentity>;
  syncProfiles(profilesJson: string): Promise<void>;
  getProfilesJson(): Promise<string>;
  startLaunchKnocks(): Promise<void>;
  getLaunchKnockResultsJson(): Promise<string>;
  scheduleRenewal(profileId: string, fireAtMs: number): Promise<void>;
  cancelRenewal(profileId: string): Promise<void>;
  cancelAllRenewals(): Promise<void>;
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
}

const native =
  requireOptionalNativeModule<KnockerNativeAndroid>("KnockerNative");

export const isNativeAvailable: boolean =
  Platform.OS === "android" && native != null;

/** Uses the Android request coordinator or signals that the JS HTTP fallback is needed. */
export async function knockProfileNative(
  id: string,
  configuration: string,
): Promise<NativeLaunchKnockResult | null> {
  if (!native?.knockProfileJson) return null;
  const raw = await native.knockProfileJson(id, configuration);
  return raw == null ? null : (JSON.parse(raw) as NativeLaunchKnockResult);
}

/** Merges native pending events without letting a stale initial read replace a newer event. */
export function subscribeToNativeKnocks(
  callback: (ids: string[]) => void,
): () => void {
  let active = true;
  let observedEvent = false;
  const subscription = native?.addListener?.("onKnockStateChanged", (event) => {
    observedEvent = true;
    if (active) callback(event.profileIds);
  });
  void native
    ?.getPendingKnockIdsJson?.()
    .then((raw) => {
      if (active && !observedEvent) callback(JSON.parse(raw));
    })
    .catch(() => {});
  return () => {
    active = false;
    subscription?.remove();
  };
}

let launchStarted = false;
let resolveLaunchResults: (results: NativeLaunchKnockResult[]) => void;
const launchResultsPromise = new Promise<NativeLaunchKnockResult[]>(
  (resolve) => {
    resolveLaunchResults = resolve;
  },
);

/** Called after the first visible frame; never starts work during module import. */
export function startLaunchKnocks(): void {
  if (launchStarted) return;
  launchStarted = true;
  if (!native?.startLaunchKnocks || !native?.getLaunchKnockResultsJson) {
    resolveLaunchResults([]);
    return;
  }
  void Promise.resolve()
    .then(() => native.startLaunchKnocks())
    .then(() => native.getLaunchKnockResultsJson())
    .then((raw) => {
      const parsed = JSON.parse(raw);
      resolveLaunchResults(Array.isArray(parsed) ? parsed : []);
    })
    .catch(() => resolveLaunchResults([]));
}

/** Reading results never starts a second batch or waits on the UI thread. */
export async function awaitLaunchKnockResults(): Promise<
  NativeLaunchKnockResult[]
> {
  if (!native?.startLaunchKnocks || !native?.getLaunchKnockResultsJson)
    return [];
  return launchResultsPromise;
}

/** Replaces the native profile cache used by launch, tiles and background renewal. */
export async function syncProfiles(
  profiles: NativeProfileSnapshot[],
): Promise<void> {
  if (!native) return;
  await native.syncProfiles(JSON.stringify(profiles));
}

/** Reads native snapshots defensively so missing or malformed caches allow JS fallback. */
export async function loadProfilesFromNative(): Promise<
  NativeProfileSnapshot[]
> {
  if (!native) return [];

  try {
    const raw = await native.getProfilesJson();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as NativeProfileSnapshot[];
  } catch {
    return [];
  }
}

/** Schedules native renewal when the platform module is available. */
export async function scheduleRenewal(
  profileId: string,
  fireAtMs: number,
): Promise<void> {
  if (!native) return;
  await native.scheduleRenewal(profileId, fireAtMs);
}

/** Cancels a profile alarm without requiring the Android module on other platforms. */
export async function cancelRenewal(profileId: string): Promise<void> {
  if (!native) return;
  await native.cancelRenewal(profileId);
}

/** Clears native renewal alarms when the platform module is present. */
export async function cancelAllRenewals(): Promise<void> {
  if (!native) return;
  await native.cancelAllRenewals();
}

/** Reports exact-alarm access without opening a permission screen. */
export async function canScheduleExactAlarms(): Promise<boolean> {
  if (!native) return false;
  return native.canScheduleExactAlarms();
}

/** Opens Android exact-alarm settings only when explicitly invoked by the user. */
export async function openExactAlarmSettings(): Promise<void> {
  if (!native) return;
  await native.openExactAlarmSettings();
}

export const TILE_SLOT_COUNT = 5;

/** Local connection identity only: no SSID, location, public IP or network request. */
export async function getNetworkIdentity(): Promise<NativeNetworkIdentity | null> {
  if (!native?.getNetworkIdentity) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      native.getNetworkIdentity(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 150);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
