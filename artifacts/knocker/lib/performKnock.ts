import { nativeKnockResult } from "./nativeKnockResult";
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
    if (native) return nativeKnockResult(native);
  } catch {
    return {
      ok: false,
      status: null,
      message: "Native knock failed",
      completedAtMillis: Date.now(),
    };
  }
  const connection = captureConnection();
  const result = await knock(profile);
  if (!result.ok) return { ...result, completedAtMillis: Date.now() };
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
