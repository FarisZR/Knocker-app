import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

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
  knockOnOpen: boolean;
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
}

interface KnockerNativeAndroid {
  syncProfiles(profilesJson: string): Promise<void>;
  getProfilesJson(): Promise<string>;
  getLaunchKnockResultsJson(): Promise<string>;
  scheduleRenewal(profileId: string, fireAtMs: number): Promise<void>;
  cancelRenewal(profileId: string): Promise<void>;
  cancelAllRenewals(): Promise<void>;
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
}

const native = requireOptionalNativeModule<KnockerNativeAndroid>("KnockerNative");

export const isNativeAvailable: boolean =
  Platform.OS === "android" && native != null;

export async function syncProfiles(
  profiles: NativeProfileSnapshot[],
): Promise<void> {
  if (!native) return;
  await native.syncProfiles(JSON.stringify(profiles));
}

export async function loadProfilesFromNative(): Promise<NativeProfileSnapshot[]> {
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

/**
 * Awaits the launch-knock batch that the native module fires from its OnCreate
 * hook (i.e. as soon as the app process starts). Returns the per-profile
 * results so the JS side can render the same launch snackbar without firing a
 * second round of HTTP requests.
 *
 * Returns [] when native is unavailable or no profile has knockOnOpen enabled.
 */
export async function awaitLaunchKnockResults(): Promise<NativeLaunchKnockResult[]> {
  if (!native) return [];

  try {
    const raw = await native.getLaunchKnockResultsJson();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as NativeLaunchKnockResult[];
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
