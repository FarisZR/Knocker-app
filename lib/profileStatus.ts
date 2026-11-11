/** A failed renewal does not revoke an existing grant. Native tiles also update
 * expiry independently of the last attempt recorded by JavaScript. */
export function isWhitelisted(
  profile: { expiresAt: number | null },
  now = Date.now(),
): boolean {
  return profile.expiresAt !== null && profile.expiresAt > now;
}

/** Fraction of the server-granted lifetime remaining; null when its start is unknown. */
export function grantRemainingFraction(
  profile: { expiresAt: number | null; whitelistedAt?: number | null },
  now = Date.now(),
): number | null {
  const { expiresAt, whitelistedAt } = profile;
  if (expiresAt == null || whitelistedAt == null || expiresAt <= whitelistedAt)
    return null;
  return Math.max(
    0,
    Math.min(1, (expiresAt - now) / (expiresAt - whitelistedAt)),
  );
}
