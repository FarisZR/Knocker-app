import { fetch as expoFetch } from "expo/fetch";
import ipaddr from "ipaddr.js";
import type { Profile } from "./profiles";

export interface ServerStatus {
  ipAddress: string;
  whitelisted: boolean;
  expiresAt: number | null;
  /** Device time of this observation, so a later grant can supersede it. */
  checkedAt: number;
}

/** A failed, unsupported or malformed check is unknown, never an inactive grant. */
export async function checkServerStatus(
  profile: Pick<Profile, "endpointUrl" | "apiKey">,
  signal: AbortSignal,
  request: typeof fetch = expoFetch,
): Promise<ServerStatus | null> {
  if (signal.aborted || !profile.endpointUrl || !profile.apiKey) return null;
  try {
    const response = await request(
      `${profile.endpointUrl.replace(/\/+$/, "")}/status`,
      {
        headers: { "X-Api-Key": profile.apiKey, Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal,
      },
    );
    if (!response.ok || signal.aborted) return null;
    const data = await response.json();
    if (
      typeof data.ip_address !== "string" ||
      !ipaddr.isValid(data.ip_address) ||
      typeof data.whitelisted !== "boolean" ||
      !Number.isInteger(data.expires_in_seconds) ||
      data.expires_in_seconds < 0 ||
      (data.whitelisted
        ? !Number.isInteger(data.expires_at) || data.expires_at <= 0
        : data.expires_at !== null || data.expires_in_seconds !== 0)
    )
      return null;
    const checkedAt = Date.now();
    return {
      checkedAt,
      ipAddress: ipaddr.process(data.ip_address).toString(),
      whitelisted: data.whitelisted,
      // Remaining TTL avoids depending on the device clock matching the server.
      expiresAt: data.whitelisted
        ? checkedAt + data.expires_in_seconds * 1000
        : null,
    };
  } catch {
    return null;
  }
}
