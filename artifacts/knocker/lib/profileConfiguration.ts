import ipaddr from "ipaddr.js";
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

/** Canonical target identity; display/renewal settings do not invalidate access. */
export function normalizedGrantTarget(
  profile: Pick<Profile, "endpointUrl" | "apiKey" | "ipOverride">,
): string {
  let target = profile.ipOverride?.trim() || "";
  try {
    if (target.includes("/")) {
      let [address, prefix] = ipaddr.parseCIDR(target);
      if (
        address.kind() === "ipv6" &&
        (address as ipaddr.IPv6).isIPv4MappedAddress() &&
        prefix >= 96
      ) {
        address = (address as ipaddr.IPv6).toIPv4Address();
        prefix -= 96;
      }
      const bytes = address
        .toByteArray()
        .map(
          (byte, index) =>
            byte & (0xff << Math.max(0, Math.min(8, (index + 1) * 8 - prefix))),
        );
      target = `${ipaddr.fromByteArray(bytes).toString()}/${prefix}`;
    } else if (target) target = ipaddr.process(target).toString();
  } catch {
    /* Invalid targets still have a stable identity until validation. */
  }
  return JSON.stringify([
    profile.endpointUrl.trim().replace(/\/+$/, ""),
    profile.apiKey.trim(),
    target,
  ]);
}

export function grantConfigurationFingerprint(
  profile: Pick<Profile, "endpointUrl" | "apiKey" | "ipOverride">,
): string {
  const target = normalizedGrantTarget(profile);
  return `${hashConfiguration(target, 0x811c9dc5).toString(16)}:${hashConfiguration(target, 0x9e3779b9).toString(16)}`;
}
