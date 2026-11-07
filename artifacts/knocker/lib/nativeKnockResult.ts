import type { NativeLaunchKnockResult } from "knocker-native";
import type { KnockResult } from "./knock";
import { grantStart } from "./grants";

/** Converts native outcomes to the shared request contract without losing receipt time. */
export function nativeKnockResult(
  result: NativeLaunchKnockResult,
): KnockResult {
  return result.ok
    ? {
        ok: true,
        whitelistedEntry: result.whitelistedEntry ?? "",
        expiresAt: result.expiresAtMillis ?? 0,
        expiresInSeconds: result.expiresInSeconds ?? 0,
        requestedTtlSeconds: result.requestedTtlSeconds,
        ttlCapped: result.ttlCapped,
        whitelistedAt:
          result.whitelistedAtMillis ??
          grantStart(
            result.expiresAtMillis ?? 0,
            result.expiresInSeconds,
            result.completedAtMillis,
          ),
        grantNetworkId: result.grantNetworkId,
        grantNetworkType: result.grantNetworkType,
        completedAtMillis: result.completedAtMillis,
      }
    : {
        ok: false,
        status: null,
        message: result.message ?? "Native knock failed",
        completedAtMillis: result.completedAtMillis,
      };
}
