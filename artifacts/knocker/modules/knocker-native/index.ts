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
}

interface KnockerNativeAndroid {
  syncProfiles(profilesJson: string): Promise<void>;
  getProfilesJson(): Promise<string>;
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
