import { nativeConfigurationFingerprint } from "./profileConfiguration";
import type { Profile } from "./profiles";
import type {
  NativeLaunchKnockResult,
  NativeProfileSnapshot,
} from "knocker-native";

/** A cached result only covers the exact saved configuration that sent it. */
export function selectLaunchResults(
  profiles: Profile[],
  results: NativeLaunchKnockResult[],
) {
  const targets = profiles.filter((profile) => profile.knockOnOpen);
  const byId = new Map(
    results
      .filter((result) =>
        targets.some(
          (profile) =>
            profile.id === result.profileId &&
            nativeConfigurationFingerprint(profile) ===
              result.configurationFingerprint,
        ),
      )
      .map((result) => [result.profileId, result]),
  );
  return {
    matching: [...byId.values()],
    missing: targets.filter((profile) => !byId.has(profile.id)),
  };
}

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
    if (!result || (profile.lastKnockAt ?? 0) > result.completedAtMillis)
      return profile;
    if (
      result.ok &&
      (profile.whitelistedAt ?? 0) > (result.whitelistedAtMillis ?? 0)
    )
      return profile;
    const attempt = {
      lastKnockAt: result.completedAtMillis,
      lastError: result.ok ? null : result.message,
    };
    return result.ok
      ? {
          ...profile,
          ...attempt,
          lastKnockStatus: "success",
          expiresAt: result.expiresAtMillis,
          whitelistedAt: result.whitelistedAtMillis,
          whitelistedEntry: result.whitelistedEntry,
          grantNetworkId: result.grantNetworkId,
          grantNetworkType: result.grantNetworkType,
        }
      : { ...profile, ...attempt, lastKnockStatus: "error" };
  });
}

export function mergeExpiryFromNative(
  profiles: Profile[],
  snapshots: NativeProfileSnapshot[],
): Profile[] {
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return profiles.map((profile) => {
    const cached = byId.get(profile.id);
    if (
      !cached ||
      cached.configurationFingerprint !==
        nativeConfigurationFingerprint(profile) ||
      cached.expiresAt == null
    )
      return profile;
    if (
      cached.expiresAt <= (profile.expiresAt ?? 0) &&
      (cached.whitelistedAt ?? 0) <= (profile.whitelistedAt ?? 0)
    )
      return profile;
    return {
      ...profile,
      expiresAt: cached.expiresAt,
      whitelistedAt: cached.whitelistedAt,
      whitelistedEntry: cached.whitelistedEntry,
      grantNetworkId: cached.grantNetworkId,
      grantNetworkType: cached.grantNetworkType,
      lastKnockStatus: "success",
      lastError: null,
    };
  });
}
