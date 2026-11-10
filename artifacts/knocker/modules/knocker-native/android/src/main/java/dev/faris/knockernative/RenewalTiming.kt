package dev.faris.knockernative

import android.content.Context

/**
 * Picks when a profile's renewal should fire on the network the device is on.
 *
 * A server keeps a separate grant per address, so after switching between two
 * networks that were both knocked, the grant covering this network is not the
 * last knock's. Expiry would otherwise be timed from the other network's grant.
 */
internal object RenewalTiming {
  private fun key(id: String) = "networkCheck.$id"

  /** Records what /status reported for [networkId]; a null expiry means not covered. */
  fun recordCoverage(context: Context, profile: StoredProfile, networkId: String, expiresAt: Long?) {
    KnockerPrefs.preferences(context).edit().putString(key(profile.id), "${profile.requestIdentity()}:$networkId")
      .putLong("${key(profile.id)}.expires", expiresAt ?: 0L).apply()
  }

  /** The renewal time on [networkId]: its own observed grant when the last knock was elsewhere. */
  fun renewalAt(context: Context, profile: StoredProfile,
    networkId: String? = KnockerNetwork.snapshot(context).id): Long? {
    val lastKnock = profile.renewalAtMillis() ?: return null
    if (networkId == null || profile.grantNetworkId == networkId) return lastKnock
    val prefs = KnockerPrefs.preferences(context)
    if (prefs.getString(key(profile.id), null) != "${profile.requestIdentity()}:$networkId") return lastKnock
    val observed = prefs.getLong("${key(profile.id)}.expires", 0L)
    return if (observed > System.currentTimeMillis()) observed - profile.autoRenewSafetyWindowSec.toLong() * 1000L else lastKnock
  }
}
