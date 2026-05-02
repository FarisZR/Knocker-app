import type { Profile } from "./profiles";

export interface KnockSuccess {
  ok: true;
  whitelistedEntry: string;
  expiresAt: number;
  expiresInSeconds: number;
}

export interface KnockFailure {
  ok: false;
  status: number | null;
  message: string;
}

export type KnockResult = KnockSuccess | KnockFailure;

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function knock(profile: Profile): Promise<KnockResult> {
  const url = `${trimSlash(profile.endpointUrl)}/knock`;
  const body: Record<string, unknown> = {};
  if (profile.ipOverride && profile.ipOverride.trim().length > 0) {
    body.ip_address = profile.ipOverride.trim();
  }
  if (profile.ttlSeconds && profile.ttlSeconds > 0) {
    body.ttl = profile.ttlSeconds;
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
    return {
      ok: true,
      whitelistedEntry: String(data.whitelisted_entry ?? ""),
      expiresAt: Number(data.expires_at ?? 0) * 1000,
      expiresInSeconds: Number(data.expires_in_seconds ?? 0),
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
