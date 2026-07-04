package com.superhero.netpilot.cellular

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.TelephonyManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CellularDiagnosticsModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    private val telephonyManager: TelephonyManager
        get() = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

    override fun definition() =
        ModuleDefinition {
            Name("CellularDiagnostics")

            Events("onSignalStrengthChanged")

            Function("getSignalStrength") {
                return@Function getRSRP()
            }

            Function("getCellularDetails") {
                return@Function getDetailsMap()
            }

            Function("getNetworkDetails") {
                return@Function getNetworkDetailsMap()
            }

            Function("startBackgroundService") {
                val intent = Intent(context, BackgroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                return@Function true
            }

            Function("stopBackgroundService") {
                val intent = Intent(context, BackgroundService::class.java)
                context.stopService(intent)
                return@Function true
            }

            Function("setPowerSaverEnabled") { enabled: Boolean ->
                val prefs = context.getSharedPreferences("netpilot_prefs", Context.MODE_PRIVATE)
                prefs.edit().putBoolean("power_saver_enabled", enabled).apply()
                return@Function true
            }
        }

    private fun requestModemScan() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                telephonyManager.requestCellInfoUpdate(
                    context.mainExecutor,
                    object : TelephonyManager.CellInfoCallback() {
                        override fun onCellInfo(cellInfo: MutableList<CellInfo>) {
                            // Cache successfully refreshed
                        }

                        override fun onError(
                            errorCode: Int,
                            detail: Throwable?,
                        ) {
                            // Ignore
                        }
                    },
                )
            } catch (e: SecurityException) {
                // Permission not granted
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    private fun getRSRP(): Int? {
        requestModemScan()
        try {
            val cellInfos = telephonyManager.allCellInfo ?: return null
            for (cellInfo in cellInfos) {
                if (cellInfo.isRegistered) {
                    when (cellInfo) {
                        is CellInfoLte -> return cellInfo.cellSignalStrength.rsrp
                        is CellInfoNr -> {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                val ss = cellInfo.cellSignalStrength
                                return ss.dbm
                            }
                        }
                    }
                }
            }
        } catch (e: SecurityException) {
            // Permission not granted
        } catch (e: Exception) {
            // General error
        }
        return null
    }

    private fun getDetailsMap(): Map<String, Any?> {
        requestModemScan()
        val result =
            mutableMapOf<String, Any?>(
                "carrier" to telephonyManager.networkOperatorName,
                "networkType" to getNetworkTypeName(),
                "rsrp" to null,
                "rsrq" to null,
                "rssi" to null,
                "sinr" to null,
                "band" to null,
                "pci" to null,
                "tac" to null,
                "cid" to null,
                "cgi" to null,
                "isRegistered" to false,
            )

        try {
            val cellInfos = telephonyManager.allCellInfo
            if (cellInfos != null) {
                for (cellInfo in cellInfos) {
                    if (cellInfo.isRegistered) {
                        result["isRegistered"] = true
                        when (cellInfo) {
                            is CellInfoLte -> {
                                val identity = cellInfo.cellIdentity
                                val signal = cellInfo.cellSignalStrength

                                result["rsrp"] = signal.rsrp
                                result["rsrq"] = signal.rsrq

                                val rawRssi = signal.rssi
                                result["rssi"] =
                                    if (rawRssi == 2147483647 || rawRssi == null || rawRssi == 0) {
                                        val rsrp = signal.rsrp
                                        if (rsrp != 2147483647 && rsrp != null && rsrp < 0) {
                                            rsrp + 17
                                        } else {
                                            null
                                        }
                                    } else {
                                        rawRssi
                                    }

                                result["sinr"] = signal.rssnr
                                result["pci"] = identity.pci
                                result["tac"] = identity.tac
                                result["cid"] = identity.ci

                                val earfcn = identity.earfcn
                                var bandLte: Int? = null
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                    val bands = identity.bands
                                    if (bands != null && bands.isNotEmpty()) {
                                        bandLte = bands[0]
                                    }
                                }
                                if (bandLte == null || bandLte == 2147483647) {
                                    bandLte = getLteBand(earfcn)
                                }
                                result["band"] = bandLte
                                result["cgi"] = "${identity.mccString}-${identity.mncString}-${identity.tac}-${identity.ci}"
                                break
                            }
                            is CellInfoNr -> {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                    val identity = cellInfo.cellIdentity as android.telephony.CellIdentityNr
                                    val signal = cellInfo.cellSignalStrength as android.telephony.CellSignalStrengthNr
                                    val rsrpNr = signal.dbm
                                    result["rsrp"] = rsrpNr
                                    result["rsrq"] = signal.ssRsrq
                                    result["sinr"] = signal.ssSinr

                                    result["rssi"] =
                                        if (rsrpNr != 2147483647 && rsrpNr != null && rsrpNr < 0) {
                                            rsrpNr + 20
                                        } else {
                                            null
                                        }
                                    result["pci"] = identity.pci
                                    result["tac"] = identity.tac
                                    result["cid"] = identity.nci

                                    val nrarfcn = identity.nrarfcn
                                    var bandNr: Int? = null
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                        val bands = identity.bands
                                        if (bands != null && bands.isNotEmpty()) {
                                            bandNr = bands[0]
                                        }
                                    }
                                    if (bandNr == null || bandNr == 2147483647) {
                                        bandNr = getNrBand(nrarfcn)
                                    }
                                    result["band"] = bandNr
                                    result["cgi"] = "${identity.mccString}-${identity.mncString}-${identity.tac}-${identity.nci}"
                                    break
                                }
                            }
                        }
                    }
                }
            }

            // Fallback: Real-time query of TelephonyManager's active signal strength (useful for Samsung/Xiaomi and cached info)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val signalStrength = telephonyManager.signalStrength
                if (signalStrength != null) {
                    val strengths = signalStrength.cellSignalStrengths
                    for (strength in strengths) {
                        when (strength) {
                            is CellSignalStrengthLte -> {
                                val rssnr = strength.rssnr
                                if (rssnr != 2147483647 && (result["sinr"] == null || result["sinr"] == 2147483647)) {
                                    result["sinr"] = rssnr
                                }
                                if (result["rsrq"] == null || result["rsrq"] == 2147483647) {
                                    val rsrq = strength.rsrq
                                    if (rsrq != 2147483647) result["rsrq"] = rsrq
                                }
                                if (result["rsrp"] == null || result["rsrp"] == 2147483647) {
                                    val rsrp = strength.rsrp
                                    if (rsrp != 2147483647) result["rsrp"] = rsrp
                                }
                                val rssi = strength.rssi
                                if (rssi != 2147483647 && rssi != 0 && (result["rssi"] == null || result["rssi"] == 2147483647)) {
                                    result["rssi"] = rssi
                                }
                            }
                            is CellSignalStrengthNr -> {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                    val ssSinr = strength.ssSinr
                                    val csiSinr = strength.csiSinr
                                    val validSinr =
                                        if (ssSinr != 2147483647) {
                                            ssSinr
                                        } else if (csiSinr != 2147483647) {
                                            csiSinr
                                        } else {
                                            2147483647
                                        }
                                    if (validSinr != 2147483647 && (result["sinr"] == null || result["sinr"] == 2147483647)) {
                                        result["sinr"] = validSinr
                                    }
                                    if (result["rsrq"] == null || result["rsrq"] == 2147483647) {
                                        val ssRsrq = strength.ssRsrq
                                        val csiRsrq = strength.csiRsrq
                                        val validRsrq =
                                            if (ssRsrq != 2147483647) {
                                                ssRsrq
                                            } else if (csiRsrq != 2147483647) {
                                                csiRsrq
                                            } else {
                                                2147483647
                                            }
                                        if (validRsrq != 2147483647) result["rsrq"] = validRsrq
                                    }
                                    if (result["rsrp"] == null || result["rsrp"] == 2147483647) {
                                        val ssRsrp = strength.ssRsrp
                                        val csiRsrp = strength.csiRsrp
                                        val validRsrp =
                                            if (ssRsrp != 2147483647) {
                                                ssRsrp
                                            } else if (csiRsrp != 2147483647) {
                                                csiRsrp
                                            } else {
                                                2147483647
                                            }
                                        if (validRsrp != 2147483647) result["rsrp"] = validRsrp
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e: SecurityException) {
            result["error"] = "SecurityException: Permissions not granted"
        } catch (e: Exception) {
            result["error"] = e.message
        }

        return result
    }

    private fun getNetworkTypeName(): String {
        try {
            val type = telephonyManager.networkType
            return when (type) {
                TelephonyManager.NETWORK_TYPE_LTE -> "LTE"
                TelephonyManager.NETWORK_TYPE_NR -> "5G"
                TelephonyManager.NETWORK_TYPE_HSDPA, TelephonyManager.NETWORK_TYPE_HSPA, TelephonyManager.NETWORK_TYPE_HSUPA -> "3G (HSPA)"
                TelephonyManager.NETWORK_TYPE_GPRS, TelephonyManager.NETWORK_TYPE_EDGE -> "2G"
                else -> "UNKNOWN ($type)"
            }
        } catch (e: SecurityException) {
            return "PERMISSION_DENIED"
        }
    }

    private fun getLteBand(earfcn: Int): Int? =
        when {
            earfcn in 0..599 -> 1
            earfcn in 600..1199 -> 2
            earfcn in 1200..1949 -> 3
            earfcn in 1950..2399 -> 4
            earfcn in 2400..2649 -> 5
            earfcn in 2750..3449 -> 7
            earfcn in 3450..3799 -> 8
            earfcn in 5000..5179 -> 12
            earfcn in 5180..5279 -> 13
            earfcn in 5280..5379 -> 14
            earfcn in 5730..5849 -> 17
            earfcn in 6000..6149 -> 20
            earfcn in 8690..9039 -> 28
            earfcn in 9210..9659 -> 31
            earfcn in 37750..38249 -> 38
            earfcn in 38250..38649 -> 39
            earfcn in 38650..39649 -> 40
            earfcn in 39650..41589 -> 41
            else -> null
        }

    private fun getNrBand(nrarfcn: Int): Int? =
        when {
            nrarfcn in 422000..434000 -> 78 // n78 (3500 MHz)
            nrarfcn in 128500..130200 -> 28 // n28 (700 MHz)
            nrarfcn in 151600..153600 -> 5 // n5 (850 MHz)
            nrarfcn in 361000..376000 -> 41 // n41 (2500 MHz)
            nrarfcn in 386000..400000 -> 77 // n77 (3700 MHz)
            else -> null
        }

    private fun getNetworkDetailsMap(): Map<String, Any?> {
        val result =
            mutableMapOf<String, Any?>(
                "ipAddress" to null,
                "gateway" to null,
                "dns" to null,
                "vpnActive" to false,
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
                        linkProperties.linkAddresses
                            .map { it.address.hostAddress }
                            .firstOrNull { it != null && !it.contains(":") }
                    result["ipAddress"] = ipv4

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
