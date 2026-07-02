package com.superhero.netpilot.cellular

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import kotlin.math.abs

class BackgroundService : Service() {
  private val CHANNEL_ID = "netpilot_telemetry_channel"
  private val NOTIFICATION_ID = 4636
  private var scheduler: ScheduledExecutorService? = null
  private var database: SQLiteDatabase? = null
  private var lastLoggedRsrp: Int? = null
  private var lastLoggedLocation: Location? = null
  private var lastLoggedNetworkType: String? = null
  
  private var currentLocation: Location? = null
  private var locationManager: LocationManager? = null

  private val locationListener = object : LocationListener {
    override fun onLocationChanged(location: Location) {
      currentLocation = location
    }
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    initializeDatabase()
    startTelemetryListeners()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildTelemetryNotification("Initializing background logger...", "—")
    startForeground(NOTIFICATION_ID, notification)
    
    // Start active background scheduler (Runs every 10 seconds to evaluate adaptive thresholds)
    scheduler = Executors.newSingleThreadScheduledExecutor()
    scheduler?.scheduleAtFixedRate({
      evaluateAdaptiveLogging()
    }, 10, 10, TimeUnit.SECONDS)

    return START_STICKY
  }

  override fun onDestroy() {
    scheduler?.shutdown()
    try {
      locationManager?.removeUpdates(locationListener)
    } catch (e: SecurityException) {
      // Ignore
    }
    database?.close()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? {
    return null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "NetPilot Telemetry Service",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Provides persistent cellular signal background logging."
      }
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }
  }

  private fun buildTelemetryNotification(status: String, signal: String): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("NetPilot Active")
      .setContentText("$status • $signal")
      .setSmallIcon(android.R.drawable.ic_menu_compass)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .build()
  }

  private fun updateNotification(status: String, signal: String) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val notification = buildTelemetryNotification(status, signal)
    manager.notify(NOTIFICATION_ID, notification)
  }

  private fun initializeDatabase() {
    try {
      val dbFile = getDatabasePath("netpilot.db")
      
      // Create databases folder if missing
      dbFile.parentFile?.mkdirs()
      
      database = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  private fun startTelemetryListeners() {
    try {
      locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      // Query coarse location updates to save power
      locationManager?.requestLocationUpdates(
        LocationManager.NETWORK_PROVIDER,
        5000L,
        10f,
        locationListener
      )
    } catch (e: SecurityException) {
      // Permission missing
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  private fun evaluateAdaptiveLogging() {
    try {
      val tm = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
      val carrier = tm.networkOperatorName
      val networkType = getNetworkTypeName(tm.networkType)
      val rsrp = getRSRP(tm)

      // Update Foreground Notification Telemetry
      val signalLabel = if (rsrp != null && rsrp != 2147483647) "$rsrp dBm" else "No Signal"
      updateNotification("Connected to $networkType", signalLabel)

      // Evaluate Adaptive thresholds
      var shouldLog = false

      // 1. Network type changes
      if (networkType != lastLoggedNetworkType) {
        shouldLog = true
      }

      // 2. Signal level shifts by > 5 dBm
      if (rsrp != null && rsrp != 2147483647) {
        if (lastLoggedRsrp == null || abs(rsrp - lastLoggedRsrp!!) > 5) {
          shouldLog = true
        }
      }

      // 3. Location shifts by > 50 meters
      val loc = currentLocation
      if (loc != null) {
        if (lastLoggedLocation == null || loc.distanceTo(lastLoggedLocation!!) > 50f) {
          shouldLog = true
        }
      }

      if (shouldLog) {
        writeLogToDatabase(carrier, networkType, rsrp, loc)
        
        // Cache logged state
        lastLoggedNetworkType = networkType
        lastLoggedRsrp = rsrp
        if (loc != null) {
          lastLoggedLocation = loc
        }
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  private fun writeLogToDatabase(carrier: String, networkType: String, rsrp: Int?, location: Location?) {
    val db = database ?: return
    try {
      val values = ContentValues().apply {
        put("timestamp", System.currentTimeMillis())
        put("signal", rsrp)
        put("carrier", carrier)
        put("network_type", networkType)
        put("latitude", location?.latitude)
        put("longitude", location?.longitude)
      }
      db.insert("network_history", null, values)
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  private fun getRSRP(tm: TelephonyManager): Int? {
    try {
      val cellInfos = tm.allCellInfo ?: return null
      for (cellInfo in cellInfos) {
        if (cellInfo.isRegistered) {
          when (cellInfo) {
            is CellInfoLte -> return cellInfo.cellSignalStrength.rsrp
            is CellInfoNr -> {
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return cellInfo.cellSignalStrength.dbm
              }
            }
          }
        }
      }
    } catch (e: SecurityException) {
      // Permission not granted
    } catch (e: Exception) {
      // Ignore
    }
    return null
  }

  private fun getNetworkTypeName(type: Int): String {
    return when (type) {
      TelephonyManager.NETWORK_TYPE_LTE -> "LTE"
      TelephonyManager.NETWORK_TYPE_NR -> "5G"
      TelephonyManager.NETWORK_TYPE_HSDPA, TelephonyManager.NETWORK_TYPE_HSPA, TelephonyManager.NETWORK_TYPE_HSUPA -> "3G"
      TelephonyManager.NETWORK_TYPE_GPRS, TelephonyManager.NETWORK_TYPE_EDGE -> "2G"
      else -> "UNKNOWN"
    }
  }
}
