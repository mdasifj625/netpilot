package com.superhero.netpilot.lan

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LanScannerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

  private var isScanning = false

  override fun definition() = ModuleDefinition {
    Name("LanScanner")

    Events("onDeviceFound", "onScanProgress", "onScanFinished")

    Function("startScan") {
      if (isScanning) return@Function false
      isScanning = true
      startPingSweep()
      return@Function true
    }

    Function("stopScan") {
      isScanning = false
      return@Function true
    }

    Function("scanDevicePorts") { ip: String ->
      val openPorts = mutableListOf<Int>()
      val ports = listOf(22, 53, 80, 443, 8080)
      for (port in ports) {
        try {
          val socket = java.net.Socket()
          socket.connect(java.net.InetSocketAddress(ip, port), 250)
          socket.close()
          openPorts.add(port)
        } catch (e: Exception) {
          // Closed
        }
      }
      return@Function openPorts
    }
  }

  private fun startPingSweep() {
    Executors.newSingleThreadExecutor().execute {
      try {
        val subnet = getLocalSubnet()
        if (subnet == null) {
          isScanning = false
          sendEvent("onScanFinished", mapOf("devicesCount" to 0))
          return@execute
        }

        val totalHosts = 254
        var scannedCount = 0
        val activeDevices = mutableListOf<String>()

        val threadPool = Executors.newFixedThreadPool(40)
        
        for (i in 1..254) {
          if (!isScanning) break
          val ip = "$subnet.$i"
          threadPool.execute {
            if (isHostReachable(ip)) {
              activeDevices.add(ip)
              val hostname = getHostName(ip)
              sendEvent("onDeviceFound", mapOf(
                "ip" to ip,
                "hostname" to hostname,
                "ping" to getPingTime(ip)
              ))
            }
            
            synchronized(this) {
              scannedCount++
              val progress = scannedCount.toFloat() / totalHosts
              sendEvent("onScanProgress", mapOf("progress" to progress))
            }
          }
        }

        threadPool.shutdown()
        threadPool.awaitTermination(30, TimeUnit.SECONDS)

        isScanning = false
        sendEvent("onScanFinished", mapOf("devicesCount" to activeDevices.size))
      } catch (e: Exception) {
        isScanning = false
        sendEvent("onScanFinished", mapOf("devicesCount" to 0))
      }
    }
  }

  private fun getLocalSubnet(): String? {
    try {
      val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val activeNetwork = cm.activeNetwork ?: return null
      val linkProperties = cm.getLinkProperties(activeNetwork) ?: return null
      val ipv4 = linkProperties.linkAddresses
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

  private fun isHostReachable(ip: String): Boolean {
    return try {
      val process = Runtime.getRuntime().exec("ping -c 1 -w 1 $ip")
      val exitCode = process.waitFor()
      exitCode == 0
    } catch (e: Exception) {
      false
    }
  }

  private fun getHostName(ip: String): String? {
    return try {
      val addr = InetAddress.getByName(ip)
      val host = addr.hostName
      if (host == ip) null else host
    } catch (e: Exception) {
      null
    }
  }

  private fun getPingTime(ip: String): Double {
    try {
      val startTime = System.nanoTime()
      val process = Runtime.getRuntime().exec("ping -c 1 -w 1 $ip")
      process.waitFor()
      val endTime = System.nanoTime()
      return (endTime - startTime) / 1_000_000.0 // convert to milliseconds
    } catch (e: Exception) {
      return -1.0
    }
  }
}
