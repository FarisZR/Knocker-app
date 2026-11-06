package dev.faris.knockernative

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.Settings

/** Connection-local, opaque identity. Does not read SSIDs/location or contact a server. */
object KnockerNetwork {
  data class Identity(val id: String?, val type: String, val isConnected: Boolean) {
    fun toMap(): Map<String, Any?> = mapOf("id" to id, "type" to type, "isConnected" to isConnected)
  }

  fun snapshot(context: Context): Identity = runCatching {
    val manager = context.getSystemService(ConnectivityManager::class.java)
    val network = manager?.activeNetwork ?: return@runCatching Identity(null, "Offline", false)
    val caps = manager.getNetworkCapabilities(network)
    val type = when {
      caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true -> "VPN"
      caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "Wi-Fi"
      caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "Cellular"
      caps?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> "Ethernet"
      else -> "Connected"
    }
    val boot = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, 0)
    Identity("$boot:${network.networkHandle}", type, true)
  }.getOrElse { Identity(null, "Unknown network", false) }
}
