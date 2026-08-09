import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface Profile {
  id: string;
  name: string;
  endpointUrl: string;
  apiKey: string;
  ttlSeconds: number | null;
  ipOverride: string | null;
  knockOnOpen: boolean;
  autoRenew: boolean;
  autoRenewSafetyWindowSec: number;
  pinnedToHome: boolean;
  tileSlot: number | null;
  lastKnockStatus: "idle" | "success" | "error";
  lastKnockAt: number | null;
  lastError: string | null;
  whitelistedEntry: string | null;
  expiresAt: number | null;
}

function hashConfiguration(value: string, seed: number): number {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Returns an opaque, deterministic fingerprint for the profile fields used by
 * the native launch knock. Expiry and prior knock state are intentionally
 * excluded because native updates those fields as part of the knock.
 */
export function nativeConfigurationFingerprint(profile: Profile): string {
  const serialized = JSON.stringify([
    profile.id,
    profile.name,
    profile.endpointUrl,
    profile.apiKey,
    profile.ttlSeconds,
    profile.ipOverride,
    profile.knockOnOpen,
    profile.autoRenew,
    profile.autoRenewSafetyWindowSec,
    profile.pinnedToHome,
    profile.tileSlot,
  ]);
  const first = hashConfiguration(serialized, 0x811c9dc5);
  const second = hashConfiguration(serialized, 0x9e3779b9);
  return `${first.toString(16).padStart(8, "0")}:${second
    .toString(16)
    .padStart(8, "0")}`;
}

type StoredProfile = Omit<Profile, "apiKey">;

const STORAGE_KEY = "knocker.profiles.v1";
const SECRET_PREFIX = "knocker.apiKey.";

export function newProfile(): Profile {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
    name: "",
    endpointUrl: "",
    apiKey: "",
    ttlSeconds: null,
    ipOverride: null,
    knockOnOpen: true,
    autoRenew: true,
    autoRenewSafetyWindowSec: 300,
    pinnedToHome: false,
    tileSlot: null,
    lastKnockStatus: "idle",
    lastKnockAt: null,
    lastError: null,
    whitelistedEntry: null,
    expiresAt: null,
  };
}

async function getSecret(id: string): Promise<string> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") return "";
      return localStorage.getItem(SECRET_PREFIX + id) ?? "";
    }
    const v = await SecureStore.getItemAsync(SECRET_PREFIX + id);
    return v ?? "";
  } catch {
    return "";
  }
}

async function setSecret(id: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") return;
      if (value) localStorage.setItem(SECRET_PREFIX + id, value);
      else localStorage.removeItem(SECRET_PREFIX + id);
      return;
    }
    if (value) {
      await SecureStore.setItemAsync(SECRET_PREFIX + id, value);
    } else {
      await SecureStore.deleteItemAsync(SECRET_PREFIX + id);
    }
  } catch {
    // ignore
  }
}

async function deleteSecret(id: string): Promise<void> {
  await setSecret(id, "");
}

export async function loadProfiles(): Promise<Profile[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const stored = parsed as StoredProfile[];
    const withKeys = await Promise.all(
      stored.map(async (p) => ({ ...p, apiKey: await getSecret(p.id) })),
    );
    return withKeys;
  } catch {
    return [];
  }
}

export async function saveProfiles(profiles: Profile[]): Promise<void> {
  // Persist API keys separately in secure storage; never write them to AsyncStorage.
  await Promise.all(profiles.map((p) => setSecret(p.id, p.apiKey)));
  const stripped: StoredProfile[] = profiles.map(({ apiKey: _k, ...rest }) => rest);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
}

export async function deleteProfileSecret(id: string): Promise<void> {
  await deleteSecret(id);
}
