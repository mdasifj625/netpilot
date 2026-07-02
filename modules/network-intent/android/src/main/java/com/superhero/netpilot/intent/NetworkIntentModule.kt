package com.superhero.netpilot.intent

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NetworkIntentModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

  override fun definition() = ModuleDefinition {
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
    val intent = Intent(Intent.ACTION_MAIN).apply {
      setClassName("com.android.settings", "com.android.settings.RadioInfo")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return try {
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }

  private fun tryLaunchMobileNetworkSettings(): Boolean {
    val intent = Intent(Settings.ACTION_DATA_ROAMING_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return try {
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      val generalIntent = Intent(Settings.ACTION_SETTINGS).apply {
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
    val intent = Intent().apply {
      setClassName("com.samsung.android.app.telephonyui", "com.samsung.android.app.telephonyui.hiddennetworksetting.MainActivity")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return try {
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      val fallbackIntent = Intent().apply {
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
