import type { Profile } from "./profiles";

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
