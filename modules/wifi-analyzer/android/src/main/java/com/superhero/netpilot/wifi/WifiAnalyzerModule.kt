package com.superhero.netpilot.wifi

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WifiAnalyzerModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    private val wifiManager: WifiManager
        get() = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    override fun definition() =
        ModuleDefinition {
            Name("WifiAnalyzer")

            Function("startScan") {
                return@Function try {
                    wifiManager.startScan()
                    true
                } catch (e: Exception) {
                    false
                }
            }

            Function("getScanResults") {
                return@Function getScanResultsList()
            }

            Function("getConnectedWifiInfo") {
                return@Function getConnectedWifiInfoMap()
            }
        }

    private fun getScanResultsList(): List<Map<String, Any?>> {
        val resultList = mutableListOf<Map<String, Any?>>()
        try {
            val scans = wifiManager.scanResults
            if (scans != null) {
                for (scan in scans) {
                    val map = mutableMapOf<String, Any?>()
                    map["ssid"] = scan.SSID
                    map["bssid"] = scan.BSSID
                    map["level"] = scan.level // Signal level in dBm
                    map["frequency"] = scan.frequency
                    map["capabilities"] = scan.capabilities
                    map["channel"] = calculateChannel(scan.frequency)
                    map["wifiStandard"] = getWifiStandardString(scan)
                    resultList.add(map)
                }
            }
        } catch (e: SecurityException) {
            // Location permissions not granted
        } catch (e: Exception) {
            // General error
        }
        return resultList
    }

    private fun getConnectedWifiInfoMap(): Map<String, Any?> {
        val result =
            mutableMapOf<String, Any?>(
                "ssid" to null,
                "bssid" to null,
                "level" to null,
                "frequency" to null,
                "linkSpeed" to null,
            )
        try {
            val info = wifiManager.connectionInfo
            if (info != null && info.networkId != -1) {
                var ssid = info.ssid
                if (ssid != null && ssid.startsWith("\"") && ssid.endsWith("\"")) {
                    ssid = ssid.substring(1, ssid.length - 1)
                }
                result["ssid"] = if (ssid == "<unknown ssid>") null else ssid
                result["bssid"] = info.bssid
                result["level"] = info.rssi
                result["frequency"] = info.frequency
                result["linkSpeed"] = info.linkSpeed // link speed in Mbps
            }
        } catch (e: Exception) {
            // Ignore
        }
        return result
    }

    private fun calculateChannel(frequency: Int): Int =
        when {
            frequency == 2484 -> 14
            frequency in 2412..2472 -> (frequency - 2407) / 5
            frequency in 5180..5825 -> (frequency - 5000) / 5
            frequency in 5955..7115 -> (frequency - 5940) / 5
            else -> 0
        }

    private fun getWifiStandardString(scan: android.net.wifi.ScanResult): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return when (scan.wifiStandard) {
                4 -> "Wi-Fi 4 (11n)"
                5 -> "Wi-Fi 5 (11ac)"
                6 -> "Wi-Fi 6 (11ax)"
                8 -> "Wi-Fi 7 (11be)"
                else -> "Legacy"
            }
        }
        return "Legacy"
    }
}
