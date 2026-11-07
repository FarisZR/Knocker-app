import type { Profile } from "./profiles";

export interface KnockSuccess {
  ok: true;
  whitelistedEntry: string;
  expiresAt: number;
  expiresInSeconds: number;
  /** Seconds requested in the body, or null if we sent no ttl. */
  requestedTtlSeconds: number | null;
  /** True when the server returned a TTL shorter than what we asked for. */
  ttlCapped: boolean;
  whitelistedAt?: number;
  grantNetworkId?: string | null;
  grantNetworkType?: string | null;
  completedAtMillis?: number;
}

export interface KnockFailure {
  ok: false;
  status: number | null;
  message: string;
  completedAtMillis?: number;
}

export type KnockResult = KnockSuccess | KnockFailure;

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Sends one bounded HTTP knock and interprets grant duration, server caps and errors. */
export async function knock(profile: Profile): Promise<KnockResult> {
  const url = `${trimSlash(profile.endpointUrl)}/knock`;
  const body: Record<string, unknown> = {};
  if (profile.ipOverride && profile.ipOverride.trim().length > 0) {
    body.ip_address = profile.ipOverride.trim();
  }
  const requestedTtl =
    profile.ttlSeconds && profile.ttlSeconds > 0 ? profile.ttlSeconds : null;
  if (requestedTtl !== null) {
    body.ttl = requestedTtl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": profile.apiKey,
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = `${res.status} ${res.statusText || ""}`.trim();
      try {
        const errBody = await res.json();
        if (errBody?.error) message = `${res.status} — ${errBody.error}`;
      } catch {
        // ignore
      }
      return { ok: false, status: res.status, message };
    }

    const data = await res.json();
    const expiresInSeconds = Number(data.expires_in_seconds ?? 0);
    // Treat a 5s slack as "applied as requested" to absorb network round-trip.
    const ttlCapped =
      requestedTtl !== null &&
      expiresInSeconds > 0 &&
      expiresInSeconds < requestedTtl - 5;

    return {
      ok: true,
      whitelistedEntry: String(data.whitelisted_entry ?? ""),
      expiresAt: Number(data.expires_at ?? 0) * 1000,
      expiresInSeconds,
      requestedTtlSeconds: requestedTtl,
      ttlCapped,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Network timeout"
          : err.message
        : "Network error";
    return { ok: false, status: null, message };
  } finally {
    clearTimeout(timeout);
  }
}
