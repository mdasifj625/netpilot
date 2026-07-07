package com.superhero.netpilot.cellular

import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.TelephonyManager
import com.superhero.netpilot.cellular.utils.CellularSignalHelper
import com.superhero.netpilot.cellular.utils.HardwareTelemetryHelper
import com.superhero.netpilot.cellular.utils.NetworkDetailsMapper
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
            }

            Function("getAdvancedHardwareMetrics") {
                return@Function HardwareTelemetryHelper.getAdvancedHardwareMetrics(context)
            }
        }

    private fun getRSRP(): Int? {
        CellularSignalHelper.requestModemScan(context, telephonyManager)
        return CellularSignalHelper.getRSRP(telephonyManager)
    }

    private fun getDetailsMap(): List<Map<String, Any?>> = CellularSignalHelper.getDetailsMap(context, telephonyManager)

    private fun getNetworkDetailsMap(): Map<String, Any?> = NetworkDetailsMapper.getNetworkDetailsMap(context)
}
