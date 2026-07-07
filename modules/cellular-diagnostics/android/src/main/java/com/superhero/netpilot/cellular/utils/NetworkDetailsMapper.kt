package com.superhero.netpilot.cellular.utils

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

object NetworkDetailsMapper {
    fun getNetworkDetailsMap(context: Context): Map<String, Any?> {
        val result =
            mutableMapOf<String, Any?>(
                "ipAddress" to null,
                "gateway" to null,
                "dns" to null,
                "vpnActive" to false,
                "subnetPrefix" to null,
                "ipv6Address" to null,
                "interfaceName" to null,
            )
        try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val activeNetwork = cm.activeNetwork
            if (activeNetwork != null) {
                val caps = cm.getNetworkCapabilities(activeNetwork)
                result["vpnActive"] = caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) ?: false

                val linkProperties = cm.getLinkProperties(activeNetwork)
                if (linkProperties != null) {
                    val ipv4 =
                        linkProperties.linkAddresses.firstOrNull {
                            it.address.hostAddress != null &&
                                !it.address.hostAddress!!.contains(":")
                        }
                    result["ipAddress"] = ipv4?.address?.hostAddress
                    result["subnetPrefix"] = ipv4?.prefixLength

                    val ipv6 =
                        linkProperties.linkAddresses.firstOrNull {
                            it.address.hostAddress != null &&
                                it.address.hostAddress!!.contains(":")
                        }
                    result["ipv6Address"] =
                        ipv6
                            ?.address
                            ?.hostAddress
                            ?.split("%")
                            ?.get(0) // Remove scope id

                    result["interfaceName"] = linkProperties.interfaceName

                    val dnsList =
                        linkProperties.dnsServers
                            .map { it.hostAddress }
                            .filter { it != null }
                    result["dns"] = if (dnsList.isNotEmpty()) dnsList.joinToString(", ") else null

                    val gateway =
                        linkProperties.routes
                            .firstOrNull { it.isDefaultRoute && it.gateway != null }
                            ?.gateway
                            ?.hostAddress
                    result["gateway"] = gateway
                }
            }
        } catch (e: Exception) {
            // Ignore
        }
        return result
    }
}
