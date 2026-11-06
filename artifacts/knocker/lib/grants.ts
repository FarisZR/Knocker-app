import type { Profile } from "./profiles";
import { normalizedGrantTarget } from "./profileConfiguration";
import type { NativeProfileSnapshot } from "knocker-native";
import type { KnockResult } from "./knock";
import { nativeConfigurationFingerprint } from "./profileConfiguration";

/** Orders permission grants by their start and receipt times, never expiry alone. */
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

/** Reconstructs the interval start, using receipt time when duration is absent. */
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

/** Keeps attempt feedback when the cached permission predates a newer attempt. */
export function hasNewerAttempt(
  profile: Profile,
  grant: { grantRecordedAt?: number | null; whitelistedAt?: number | null },
): boolean {
  return (
    (profile.lastKnockAt ?? 0) >
    (grant.grantRecordedAt ?? grant.whitelistedAt ?? 0)
  );
}

/** Checks only permission identity for successes; errors require the sent settings. */
export function acceptsKnockResult(
  current: Profile,
  sent: Profile,
  result: KnockResult,
): boolean {
  return result.ok
    ? normalizedGrantTarget(current) === normalizedGrantTarget(sent)
    : nativeConfigurationFingerprint(current) ===
        nativeConfigurationFingerprint(sent);
}

/** Applies a completed request without discarding a newer grant or attempt. */
export function applyKnockResult(
  current: Profile,
  sent: Profile,
  result: KnockResult,
  receivedAt = Date.now(),
): Profile {
  if (!acceptsKnockResult(current, sent, result)) return current;
  const completedAt = result.completedAtMillis ?? receivedAt;
  let next = current;
  if (result.ok) {
    const grant = {
      expiresAt: result.expiresAt,
      whitelistedAt:
        result.whitelistedAt ??
        grantStart(result.expiresAt, result.expiresInSeconds, completedAt),
      grantRecordedAt: completedAt,
      whitelistedEntry: result.whitelistedEntry,
      grantNetworkId: result.grantNetworkId ?? null,
      grantNetworkType: result.grantNetworkType ?? null,
    };
    if (isNewerGrant(grant, current)) next = { ...current, ...grant };
  }
  const latestOutcome = Math.max(
    current.lastKnockAt ?? 0,
    current.grantRecordedAt ?? current.whitelistedAt ?? 0,
  );
  if (completedAt >= latestOutcome)
    next = {
      ...next,
      lastKnockAt: completedAt,
      lastKnockStatus: result.ok ? "success" : "error",
      lastError: result.ok ? null : result.message,
    };
  return next;
}

/** Imports newer permission metadata for the same target while retaining local settings. */
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
    const newerAttempt = hasNewerAttempt(profile, cached);
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
