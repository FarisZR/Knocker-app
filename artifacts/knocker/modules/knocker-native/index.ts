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
  whitelistedEntry: string | null;
  grantNetworkId: string | null;
  grantNetworkType: string | null;
  knockOnOpen: boolean;
  configurationFingerprint: string;
}

export interface NativeLaunchKnockResult {
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

export async function syncProfiles(
  profiles: NativeProfileSnapshot[],
): Promise<void> {
  if (!native) return;
  await native.syncProfiles(JSON.stringify(profiles));
}

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

export async function scheduleRenewal(
  profileId: string,
  fireAtMs: number,
): Promise<void> {
  if (!native) return;
  await native.scheduleRenewal(profileId, fireAtMs);
}

export async function cancelRenewal(profileId: string): Promise<void> {
  if (!native) return;
  await native.cancelRenewal(profileId);
}

export async function cancelAllRenewals(): Promise<void> {
  if (!native) return;
  await native.cancelAllRenewals();
}

export async function canScheduleExactAlarms(): Promise<boolean> {
  if (!native) return false;
  return native.canScheduleExactAlarms();
}

export async function openExactAlarmSettings(): Promise<void> {
  if (!native) return;
  await native.openExactAlarmSettings();
}

export const TILE_SLOT_COUNT = 5;

/** Local connection identity only: no SSID, location, public IP or network request. */
export async function getNetworkIdentity(): Promise<NativeNetworkIdentity | null> {
  if (!native?.getNetworkIdentity) return null;
  try {
    return await native.getNetworkIdentity();
  } catch {
    return null;
  }
}
