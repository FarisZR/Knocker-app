import AsyncStorage from "@react-native-async-storage/async-storage";

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

const STORAGE_KEY = "knocker.profiles.v1";

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

export async function loadProfiles(): Promise<Profile[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Profile[];
  } catch {
    return [];
  }
}

export async function saveProfiles(profiles: Profile[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}
