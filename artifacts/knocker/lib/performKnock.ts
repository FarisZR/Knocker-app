import { knockProfileNative } from "knocker-native";
import { knock, type KnockResult } from "./knock";
import { nativeConfigurationFingerprint } from "./profileConfiguration";
import { captureConnection } from "./networkIdentity";
import { grantStart } from "./grants";
import type { Profile } from "./profiles";

/** Android requests share the tile/renewal coordinator; other platforms retain fetch. */
export async function performKnock(profile: Profile): Promise<KnockResult> {
  try {
    const native = await knockProfileNative(
      profile.id,
      nativeConfigurationFingerprint(profile),
    );
    if (native)
      return native.ok
        ? {
            ok: true,
            whitelistedEntry: native.whitelistedEntry ?? "",
            expiresAt: native.expiresAtMillis ?? 0,
            expiresInSeconds: native.expiresInSeconds ?? 0,
            requestedTtlSeconds: native.requestedTtlSeconds,
            ttlCapped: native.ttlCapped,
            whitelistedAt:
              native.whitelistedAtMillis ?? native.completedAtMillis,
            grantNetworkId: native.grantNetworkId,
            grantNetworkType: native.grantNetworkType,
            completedAtMillis: native.completedAtMillis,
          }
        : {
            ok: false,
            status: null,
            message: native.message ?? "Native knock failed",
          };
  } catch {
    return { ok: false, status: null, message: "Native knock failed" };
  }
  const connection = captureConnection();
  const result = await knock(profile);
  if (!result.ok) return result;
  const now = Date.now();
  const network = connection();
  return {
    ...result,
    whitelistedAt: grantStart(result.expiresAt, result.expiresInSeconds, now),
    grantNetworkId: network?.id ?? null,
    grantNetworkType: network?.type ?? null,
    completedAtMillis: now,
  };
}
