package com.superhero.netpilot.intent

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NetworkIntentModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    override fun definition() =
        ModuleDefinition {
            Name("NetworkIntent")

            Function("launchRadioInfo") {
                return@Function tryLaunchRadioInfo()
            }

            Function("launchMobileNetworkSettings") {
                return@Function tryLaunchMobileNetworkSettings()
            }

            Function("launchSamsungBandSelection") {
                return@Function tryLaunchSamsungBandSelection()
            }
        }

    private fun tryLaunchRadioInfo(): Boolean {
        android.util.Log.d("NetPilotIntent", "tryLaunchRadioInfo starting fallback chain")

        val isSamsung =
            android.os.Build.MANUFACTURER
                .equals("samsung", ignoreCase = true)
        android.util.Log.d("NetPilotIntent", "Device manufacturer is: ${android.os.Build.MANUFACTURER} (isSamsung: $isSamsung)")

        val intents = mutableListOf<Pair<String, Intent>>()

        val samsungIntents =
            listOf(
                "Samsung Hidden Network Settings" to
                    Intent().apply {
                        setClassName(
                            "com.samsung.android.app.telephonyui",
                            "com.samsung.android.app.telephonyui.hiddennetworksetting.MainActivity",
                        )
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                "Samsung Band Selection" to
                    Intent().apply {
                        setClassName("com.samsung.android.app.telephonyui", "com.samsung.android.app.telephonyui.BandSelection")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
            )

        val standardIntents =
            listOf(
                // 0. Android 11+ RadioInfo in com.android.phone package
                "Android 11+ RadioInfo (com.android.phone)" to
                    Intent(Intent.ACTION_MAIN).apply {
                        setClassName("com.android.phone", "com.android.phone.settings.RadioInfo")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                // 1. Standard Testing Settings (very common fallback)
                "Standard TestingSettings" to
                    Intent().apply {
                        setClassName("com.android.settings", "com.android.settings.TestingSettings")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                // 2. Standard Testing Settings Alias
                "TestingSettingsActivity Alias" to
                    Intent().apply {
                        setClassName("com.android.settings", "com.android.settings.Settings\$TestingSettingsActivity")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                // 3. Direct RadioInfo Settings (default for Android < 11)
                "RadioInfo Direct (com.android.settings)" to
                    Intent(Intent.ACTION_MAIN).apply {
                        setClassName("com.android.settings", "com.android.settings.RadioInfo")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                // 4. Oppo/OnePlus/Realme (ColorOS/RealmeUI) Engineer Mode
                "Oppo EngineMode" to
                    Intent().apply {
                        setClassName("com.oplus.engineermode", "com.oplus.engineermode.EngineMode")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                "Android EngineeringMode" to
                    Intent().apply {
                        setClassName("com.android.engineeringmode", "com.android.engineeringmode.EngineeringMode")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                // 5. MediaTek Specific Engineer Mode
                "MTK CellConnEM" to
                    Intent().apply {
                        setClassName("com.mediatek.engineermode", "com.mediatek.engineermode.CellConnEM.CellConnEM")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
                "MTK EngineerMode" to
                    Intent().apply {
                        setClassName("com.mediatek.engineermode", "com.mediatek.engineermode.EngineerMode")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    },
            )

        if (isSamsung) {
            intents.addAll(samsungIntents)
            intents.addAll(standardIntents)
        } else {
            intents.addAll(standardIntents)
            intents.addAll(samsungIntents)
        }

        for ((name, intent) in intents) {
            try {
                android.util.Log.d("NetPilotIntent", "Attempting to launch: $name")
                context.startActivity(intent)
                android.util.Log.d("NetPilotIntent", "Successfully launched: $name")
                return true
            } catch (e: Exception) {
                android.util.Log.w("NetPilotIntent", "Failed to launch $name: ${e.message}")
            }
        }

        // 6. Fallback to dialer populated with the secret code
        try {
            android.util.Log.d("NetPilotIntent", "Attempting dialer fallback prefill")
            val encodedCode = android.net.Uri.encode("*#*#4636#*#*")
            val dialIntent =
                Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:$encodedCode")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            context.startActivity(dialIntent)
            android.util.Log.d("NetPilotIntent", "Successfully opened dialer fallback")
            return true
        } catch (e: Exception) {
            android.util.Log.e("NetPilotIntent", "Failed dialer fallback: ${e.message}", e)
        }

        android.util.Log.e("NetPilotIntent", "All RadioInfo fallbacks failed!")
        return false
    }

    private fun tryLaunchMobileNetworkSettings(): Boolean {
        val intent =
            Intent(Settings.ACTION_DATA_ROAMING_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        return try {
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            val generalIntent =
                Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            try {
                context.startActivity(generalIntent)
                true
            } catch (ex: Exception) {
                false
            }
        }
    }

    private fun tryLaunchSamsungBandSelection(): Boolean {
        val intent =
            Intent().apply {
                setClassName("com.samsung.android.app.telephonyui", "com.samsung.android.app.telephonyui.hiddennetworksetting.MainActivity")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        return try {
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            val fallbackIntent =
                Intent().apply {
                    setClassName("com.samsung.android.app.telephonyui", "com.samsung.android.app.telephonyui.BandSelection")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            try {
                context.startActivity(fallbackIntent)
                true
            } catch (ex: Exception) {
                false
            }
        }
    }
}
