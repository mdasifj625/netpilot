package com.superhero.netpilot.lan.utils

import android.content.Context
import android.net.ConnectivityManager
import java.net.InetAddress

object LanScannerHelper {
    fun getLocalSubnet(context: Context): String? {
        try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val activeNetwork = cm.activeNetwork ?: return null
            val linkProperties = cm.getLinkProperties(activeNetwork) ?: return null
            val ipv4 =
                linkProperties.linkAddresses
                    .map { it.address.hostAddress }
                    .firstOrNull { it != null && !it.contains(":") } ?: return null

            val parts = ipv4.split(".")
            if (parts.size >= 3) {
                return "${parts[0]}.${parts[1]}.${parts[2]}"
            }
        } catch (e: Exception) {
            // Ignore
        }
        return null
    }

    fun isHostReachable(ip: String): Boolean =
        try {
            val process = Runtime.getRuntime().exec("ping -c 1 -w 1 $ip")
            val exitCode = process.waitFor()
            exitCode == 0
        } catch (e: Exception) {
            false
        }

    fun getHostName(ip: String): String? =
        try {
            val addr = InetAddress.getByName(ip)
            val host = addr.hostName
            if (host == ip) null else host
        } catch (e: Exception) {
            null
        }

    fun getPingTime(ip: String): Double =
        try {
            val startTime = System.nanoTime()
            val process = Runtime.getRuntime().exec("ping -c 1 -w 1 $ip")
            process.waitFor()
            val endTime = System.nanoTime()
            (endTime - startTime) / 1_000_000.0 // convert to milliseconds
        } catch (e: Exception) {
            -1.0
        }
}
