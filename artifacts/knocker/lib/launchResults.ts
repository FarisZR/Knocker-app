import {
  grantConfigurationFingerprint,
  nativeConfigurationFingerprint,
} from "./profileConfiguration";
import { applyKnockResult, mergeGrantsForSave } from "./grants";
import { nativeKnockResult } from "./nativeKnockResult";
import type { Profile } from "./profiles";
import type {
  NativeLaunchKnockResult,
  NativeProfileSnapshot,
} from "knocker-native";

/** Matches permission identity across display edits; legacy results need an exact snapshot. */
function acceptsNativeResult(
  profile: Profile,
  result: NativeLaunchKnockResult,
): boolean {
  if (profile.id !== result.profileId) return false;
  if (!result.grantConfigurationFingerprint)
    return (
      profile.knockOnOpen &&
      nativeConfigurationFingerprint(profile) ===
        result.configurationFingerprint
    );
  if (
    grantConfigurationFingerprint(profile) !==
    result.grantConfigurationFingerprint
  )
    return false;
  // A received grant remains valid if TTL or launch preferences changed. A failed
  // request covers only the same HTTP target and TTL, avoiding duplicate retries.
  return (
    result.ok ||
    (profile.ttlSeconds ?? null) === (result.requestedTtlSeconds ?? null)
  );
}

/** Falls back only for enabled targets without a matching completed native request. */
export function selectLaunchResults(
  profiles: Profile[],
  results: NativeLaunchKnockResult[],
) {
  const byId = new Map(
    results
      .filter((result) =>
        profiles.some((profile) => acceptsNativeResult(profile, result)),
      )
      .map((result) => [result.profileId, result]),
  );
  return {
    matching: [...byId.values()],
    missing: profiles.filter(
      (profile) => profile.knockOnOpen && !byId.has(profile.id),
    ),
  };
}

/** Records valid launch grants while retaining newer grants and later attempt feedback. */
export function applyLaunchResults(
  profiles: Profile[],
  results: NativeLaunchKnockResult[],
): Profile[] {
  const byId = new Map(
    selectLaunchResults(profiles, results).matching.map((result) => [
      result.profileId,
      result,
    ]),
  );
  return profiles.map((profile) => {
    const result = byId.get(profile.id);
    return result
      ? applyKnockResult(profile, profile, nativeKnockResult(result))
      : profile;
  });
}

/** Reconciles tile/renewal grants with the same ordering rules used when saving edits. */
export function mergeExpiryFromNative(
  profiles: Profile[],
  snapshots: NativeProfileSnapshot[],
): Profile[] {
  return mergeGrantsForSave(profiles, snapshots);
}
