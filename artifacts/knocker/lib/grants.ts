import type { Profile } from "./profiles";
import { normalizedGrantTarget } from "./profileConfiguration";
import type { NativeProfileSnapshot } from "knocker-native";

export function isNewerGrant(
  candidate: {
    whitelistedAt?: number | null;
    grantRecordedAt?: number | null;
    expiresAt: number | null;
  },
  current: {
    whitelistedAt?: number | null;
    grantRecordedAt?: number | null;
    expiresAt: number | null;
  },
): boolean {
  if (candidate.expiresAt == null) return false;
  if (current.whitelistedAt != null) {
    if (candidate.whitelistedAt == null) return false;
    if (candidate.whitelistedAt !== current.whitelistedAt)
      return candidate.whitelistedAt > current.whitelistedAt;
  } else if (candidate.whitelistedAt != null) return true;
  if (
    candidate.grantRecordedAt != null &&
    current.grantRecordedAt != null &&
    candidate.grantRecordedAt !== current.grantRecordedAt
  )
    return candidate.grantRecordedAt > current.grantRecordedAt;
  return candidate.expiresAt > (current.expiresAt ?? 0);
}

export function grantStart(
  expiresAt: number,
  duration: number | null,
  now: number,
): number {
  return duration != null && Number.isFinite(duration) && duration > 0
    ? expiresAt - duration * 1000
    : now;
}

/** Preserve the latest grant only for the endpoint, key and IP target that earned it. */
export function prepareProfileSave(
  draft: Profile,
  existing: Profile | null | undefined,
): Profile {
  if (!existing) return draft;
  if (normalizedGrantTarget(draft) !== normalizedGrantTarget(existing))
    return {
      ...draft,
      expiresAt: null,
      whitelistedAt: null,
      grantRecordedAt: null,
      whitelistedEntry: null,
      grantNetworkId: null,
      grantNetworkType: null,
      lastKnockAt: null,
      lastKnockStatus: "idle",
      lastError: null,
    };
  return {
    ...draft,
    expiresAt: existing.expiresAt,
    whitelistedAt: existing.whitelistedAt,
    grantRecordedAt: existing.grantRecordedAt,
    whitelistedEntry: existing.whitelistedEntry,
    grantNetworkId: existing.grantNetworkId,
    grantNetworkType: existing.grantNetworkType,
    lastKnockAt: existing.lastKnockAt,
    lastKnockStatus: existing.lastKnockStatus,
    lastError: existing.lastError,
  };
}

export function mergeGrantsForSave(
  profiles: Profile[],
  snapshots: NativeProfileSnapshot[],
): Profile[] {
  const byId = new Map(snapshots.map((profile) => [profile.id, profile]));
  return profiles.map((profile) => {
    const cached = byId.get(profile.id);
    if (
      !cached ||
      normalizedGrantTarget(cached) !== normalizedGrantTarget(profile) ||
      !isNewerGrant(cached, profile)
    )
      return profile;
    const newerAttempt =
      (profile.lastKnockAt ?? 0) > (cached.whitelistedAt ?? 0);
    return {
      ...profile,
      expiresAt: cached.expiresAt,
      whitelistedAt: cached.whitelistedAt,
      grantRecordedAt: cached.grantRecordedAt,
      whitelistedEntry: cached.whitelistedEntry,
      grantNetworkId: cached.grantNetworkId,
      grantNetworkType: cached.grantNetworkType,
      lastKnockStatus: newerAttempt ? profile.lastKnockStatus : "success",
      lastError: newerAttempt ? profile.lastError : null,
    };
  });
}
