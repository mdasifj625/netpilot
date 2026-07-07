package com.superhero.netpilot.cellular.utils

import android.content.Context
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager

object CellularSignalHelper {
    fun requestModemScan(
        context: Context,
        telephonyManager: TelephonyManager,
    ) {
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

    fun getRSRP(telephonyManager: TelephonyManager): Int? {
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

    fun getNetworkTypeName(telephonyManager: TelephonyManager): String {
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

    fun getNetworkTypeName(type: Int): String =
        when (type) {
            TelephonyManager.NETWORK_TYPE_LTE -> "LTE"
            TelephonyManager.NETWORK_TYPE_NR -> "5G"
            TelephonyManager.NETWORK_TYPE_HSDPA, TelephonyManager.NETWORK_TYPE_HSPA, TelephonyManager.NETWORK_TYPE_HSUPA -> "3G"
            TelephonyManager.NETWORK_TYPE_GPRS, TelephonyManager.NETWORK_TYPE_EDGE -> "2G"
            else -> "UNKNOWN"
        }

    fun getLteBand(earfcn: Int): Int? =
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

    fun getNrBand(nrarfcn: Int): Int? =
        when {
            nrarfcn in 422000..434000 -> 78 // n78 (3500 MHz)
            nrarfcn in 128500..130200 -> 28 // n28 (700 MHz)
            nrarfcn in 151600..153600 -> 5 // n5 (850 MHz)
            nrarfcn in 361000..376000 -> 41 // n41 (2500 MHz)
            nrarfcn in 386000..400000 -> 77 // n77 (3700 MHz)
            else -> null
        }

    fun getDetailsMap(
        context: Context,
        telephonyManager: TelephonyManager,
    ): List<Map<String, Any?>> {
        requestModemScan(context, telephonyManager)
        val results = mutableListOf<Map<String, Any?>>()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                val activeSubs = subManager.activeSubscriptionInfoList
                if (activeSubs != null && activeSubs.isNotEmpty()) {
                    val sortedSubs = activeSubs.sortedBy { it.simSlotIndex }
                    val globalCells = telephonyManager.allCellInfo ?: emptyList()

                    for (subInfo in sortedSubs) {
                        val tmForSub = telephonyManager.createForSubscriptionId(subInfo.subscriptionId)
                        val subMcc =
                            if (Build.VERSION.SDK_INT >=
                                Build.VERSION_CODES.Q
                            ) {
                                subInfo.mccString
                            } else {
                                subInfo.mcc.toString().padStart(3, '0')
                            }
                        val subMnc =
                            if (Build.VERSION.SDK_INT >=
                                Build.VERSION_CODES.Q
                            ) {
                                subInfo.mncString
                            } else {
                                subInfo.mnc.toString().padStart(2, '0')
                            }

                        var matchedCell: CellInfo? = null
                        try {
                            val subCells = tmForSub.allCellInfo ?: emptyList()
                            matchedCell = subCells.find { it.isRegistered && matchesMccMnc(it, subMcc, subMnc) }
                        } catch (e: Exception) {
                        }

                        if (matchedCell == null) {
                            matchedCell = globalCells.find { it.isRegistered && matchesMccMnc(it, subMcc, subMnc) }
                        }

                        // If still null, just take any registered cell (fallback for same carrier dual SIM if mcc/mnc is missing)
                        if (matchedCell == null) {
                            matchedCell = globalCells.find { it.isRegistered && !results.any { r -> r["cgi"] == extractCgi(it) } }
                        }

                        val result =
                            mutableMapOf<String, Any?>(
                                "carrier" to
                                    (
                                        tmForSub.networkOperatorName.takeIf {
                                            !it.isNullOrBlank()
                                        } ?: subInfo.carrierName?.toString() ?: "Unknown"
                                    ),
                                "networkType" to getNetworkTypeName(tmForSub),
                                "rsrp" to null,
                                "rsrq" to null,
                                "rssi" to null,
                                "sinr" to null,
                                "band" to null,
                                "pci" to null,
                                "tac" to null,
                                "cid" to null,
                                "cgi" to null,
                                "isRegistered" to true,
                                "simId" to subInfo.simSlotIndex,
                            )

                        if (matchedCell != null) {
                            populateResultFromCellInfo(result, matchedCell)
                        }

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            val signalStrength = tmForSub.signalStrength
                            if (signalStrength != null) {
                                applySignalStrengthFallback(result, signalStrength)
                            }
                        }

                        results.add(result)
                    }
                    return results
                }
            }
        } catch (e: Exception) {
            val errResult = mutableMapOf<String, Any?>("error" to e.message)
            results.add(errResult)
        }

        return results
    }

    private fun extractCgi(cell: CellInfo): String? {
        try {
            when (cell) {
                is CellInfoLte -> {
                    val id = cell.cellIdentity
                    return "${id.mccString}-${id.mncString}-${id.tac}-${id.ci}"
                }
                is CellInfoNr -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val id = cell.cellIdentity as? android.telephony.CellIdentityNr
                        if (id != null) return "${id.mccString}-${id.mncString}-${id.tac}-${id.nci}"
                    }
                }
            }
        } catch (e: Exception) {
        }
        return null
    }

    private fun matchesMccMnc(
        cell: CellInfo,
        subMcc: String?,
        subMnc: String?,
    ): Boolean {
        if (subMcc == null || subMnc == null) return false
        try {
            when (cell) {
                is CellInfoLte -> {
                    val id = cell.cellIdentity
                    return id.mccString == subMcc && id.mncString == subMnc
                }
                is CellInfoNr -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val id = cell.cellIdentity as? android.telephony.CellIdentityNr
                        if (id != null) {
                            return id.mccString == subMcc && id.mncString == subMnc
                        }
                    }
                }
            }
        } catch (e: Exception) {
        }
        return false
    }

    private fun populateResultFromCellInfo(
        result: MutableMap<String, Any?>,
        cellInfo: CellInfo,
    ) {
        try {
            when (cellInfo) {
                is CellInfoLte -> {
                    val identity = cellInfo.cellIdentity
                    val signal = cellInfo.cellSignalStrength
                    result["rsrp"] = signal.rsrp
                    result["rsrq"] = signal.rsrq
                    val rawRssi = signal.rssi
                    result["rssi"] = if (rawRssi == 2147483647 || rawRssi == 0) null else rawRssi
                    result["sinr"] = signal.rssnr
                    result["pci"] = identity.pci
                    result["tac"] = identity.tac
                    result["cid"] = identity.ci
                    var bandLte: Int? = null
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        val bands = identity.bands
                        if (bands != null && bands.isNotEmpty()) bandLte = bands[0]
                    }
                    if (bandLte == null || bandLte == 2147483647) bandLte = getLteBand(identity.earfcn)
                    result["band"] = bandLte
                    result["cgi"] = "${identity.mccString}-${identity.mncString}-${identity.tac}-${identity.ci}"
                }
                is CellInfoNr -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val identity = cellInfo.cellIdentity as android.telephony.CellIdentityNr
                        val signal = cellInfo.cellSignalStrength as android.telephony.CellSignalStrengthNr
                        result["rsrp"] = signal.dbm
                        result["rsrq"] = signal.ssRsrq
                        result["sinr"] = signal.ssSinr
                        result["rssi"] = if (signal.dbm != 2147483647 && signal.dbm < 0) signal.dbm + 20 else null
                        result["pci"] = identity.pci
                        result["tac"] = identity.tac
                        result["cid"] = identity.nci
                        var bandNr: Int? = null
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            val bands = identity.bands
                            if (bands != null && bands.isNotEmpty()) bandNr = bands[0]
                        }
                        if (bandNr == null || bandNr == 2147483647) bandNr = getNrBand(identity.nrarfcn)
                        result["band"] = bandNr
                        result["cgi"] = "${identity.mccString}-${identity.mncString}-${identity.tac}-${identity.nci}"
                    }
                }
            }
        } catch (e: Exception) {
        }
    }

    private fun applySignalStrengthFallback(
        result: MutableMap<String, Any?>,
        signalStrength: android.telephony.SignalStrength,
    ) {
        try {
            val strengths = signalStrength.cellSignalStrengths
            for (strength in strengths) {
                when (strength) {
                    is CellSignalStrengthLte -> {
                        if (strength.rssnr != 2147483647) result["sinr"] = strength.rssnr
                        if (strength.rsrq != 2147483647) result["rsrq"] = strength.rsrq
                        if (strength.rsrp != 2147483647) result["rsrp"] = strength.rsrp
                        if (strength.rssi != 2147483647 && strength.rssi != 0) result["rssi"] = strength.rssi
                    }
                    is CellSignalStrengthNr -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            val validSinr =
                                if (strength.ssSinr !=
                                    2147483647
                                ) {
                                    strength.ssSinr
                                } else if (strength.csiSinr != 2147483647) {
                                    strength.csiSinr
                                } else {
                                    2147483647
                                }
                            if (validSinr != 2147483647) result["sinr"] = validSinr

                            val validRsrq =
                                if (strength.ssRsrq !=
                                    2147483647
                                ) {
                                    strength.ssRsrq
                                } else if (strength.csiRsrq != 2147483647) {
                                    strength.csiRsrq
                                } else {
                                    2147483647
                                }
                            if (validRsrq != 2147483647) result["rsrq"] = validRsrq

                            val validRsrp =
                                if (strength.ssRsrp !=
                                    2147483647
                                ) {
                                    strength.ssRsrp
                                } else if (strength.csiRsrp != 2147483647) {
                                    strength.csiRsrp
                                } else {
                                    2147483647
                                }
                            if (validRsrp != 2147483647) result["rsrp"] = validRsrp
                        }
                    }
                }
            }
        } catch (e: Exception) {
        }
    }
}
