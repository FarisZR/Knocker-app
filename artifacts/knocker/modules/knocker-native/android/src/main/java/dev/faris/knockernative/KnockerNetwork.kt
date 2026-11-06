package dev.faris.knockernative

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.provider.Settings

/** Local identity only. No SSID, location, IP service or network request. */
object KnockerNetwork {
  data class Identity(val id: String?, val type: String, val isConnected: Boolean) {
    fun toMap(): Map<String, Any?> = mapOf("id" to id, "type" to type, "isConnected" to isConnected)
  }
  data class Connection(val identity: Identity, val network: Network?)

  fun snapshot(context: Context): Identity = capture(context).identity

  fun capture(context: Context): Connection = runCatching {
    val manager = context.getSystemService(ConnectivityManager::class.java)
    val network = manager?.activeNetwork
      ?: return@runCatching Connection(Identity(null, "Offline", false), null)
    val caps = manager.getNetworkCapabilities(network)
    val vpn = caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
    val type = when {
      vpn -> "VPN"
      caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "Wi-Fi"
      caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "Cellular"
      caps?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> "Ethernet"
      else -> "Connected"
    }
    val transports = (0..8).filter { caps?.hasTransport(it) == true }.joinToString(",")
    // Public VPN capabilities expose inherited transport types. Include local
    // non-VPN topology as a conservative signal for same-transport reconnects.
    val underlying = if (!vpn) emptyList() else {
      manager.allNetworks.filter { candidate ->
        val candidateCaps = manager.getNetworkCapabilities(candidate)
        candidate != network && candidateCaps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true &&
          !candidateCaps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
      }
    }
    val topology = underlying.map { it.networkHandle }.sorted().joinToString(",")
    val boot = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, 0)
    Connection(Identity("$boot:${network.networkHandle}:$transports:$topology", type, true), network)
  }.getOrElse { Connection(Identity(null, "Unknown network", false), null) }
}
