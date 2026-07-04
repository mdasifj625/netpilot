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
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.abs

class BackgroundService : Service(), SensorEventListener {
  private val CHANNEL_ID = "netpilot_telemetry_channel"
  private val NOTIFICATION_ID = 4636
  private var scheduler: ScheduledExecutorService? = null
  private var database: SQLiteDatabase? = null
  private var lastLoggedRsrp: Int? = null
  private var lastLoggedLocation: Location? = null
  private var lastLoggedNetworkType: String? = null
  
  private var currentLocation: Location? = null
  private var locationManager: LocationManager? = null

  // Accelerometer states for motion detection
  private var sensorManager: SensorManager? = null
  private var accelerometer: Sensor? = null
  private var isStationary = false
  private var lastAcceleration = 0f
  private var currentAcceleration = 0f
  private var shake = 0f
  private var lastRunTime = 0L

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
    initializeSensor()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildTelemetryNotification("Initializing background logger...", "—")
    startForeground(NOTIFICATION_ID, notification)
    
    // Start active background scheduler
    scheduler = Executors.newSingleThreadScheduledExecutor()
    scheduler?.scheduleAtFixedRate({
      val prefs = getSharedPreferences("netpilot_prefs", Context.MODE_PRIVATE)
      val powerSaver = prefs.getBoolean("power_saver_enabled", false)
      val now = System.currentTimeMillis()
      val intervalLimit = if (powerSaver) 60000L else 10000L

      if (now - lastRunTime >= intervalLimit) {
        lastRunTime = now
        evaluateAdaptiveLogging()
      }
    }, 10, 10, TimeUnit.SECONDS)

    return START_STICKY
  }

  override fun onDestroy() {
    scheduler?.shutdown()
    try {
      locationManager?.removeUpdates(locationListener)
      sensorManager?.unregisterListener(this)
    } catch (e: Exception) {
      // Ignore
    }
    database?.close()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? {
    return null
  }

  private fun initializeSensor() {
    try {
      sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
      accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
      sensorManager?.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_NORMAL)
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onSensorChanged(event: SensorEvent?) {
    if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
    val x = event.values[0]
    val y = event.values[1]
    val z = event.values[2]

    lastAcceleration = currentAcceleration
    currentAcceleration = Math.sqrt((x * x + y * y + z * z).toDouble()).toFloat()
    val delta = currentAcceleration - lastAcceleration
    shake = shake * 0.9f + delta

    // Power Saver Mode specific dynamic location pause
    val prefs = getSharedPreferences("netpilot_prefs", Context.MODE_PRIVATE)
    val powerSaver = prefs.getBoolean("power_saver_enabled", false)

    if (powerSaver) {
      val movementThreshold = 0.4f
      val wasStationary = isStationary
      isStationary = abs(shake) < movementThreshold

      if (isStationary != wasStationary) {
        if (isStationary) {
          // Device is static, remove location listener updates
          try {
            locationManager?.removeUpdates(locationListener)
          } catch (e: SecurityException) {
            // Ignore
          }
        } else {
          // Device has started moving, resume GPS listeners
          startTelemetryListeners()
        }
      }
    }
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
      
      val db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
      database = db

      // Auto-clean database records older than 30 days to save storage footprint
      val thirtyDaysAgo = System.currentTimeMillis() - (30L * 24 * 60 * 60 * 1000)
      db.execSQL("DELETE FROM network_history WHERE timestamp < ?", arrayOf(thirtyDaysAgo))
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

      // Evaluate active background rules
      evaluateAutomationRules(rsrp)

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

  private fun evaluateAutomationRules(rsrp: Int?) {
    val db = database ?: return
    try {
      // Query SQLite for active automation rules
      val cursor = db.rawQuery(
        "SELECT trigger_type, operator, value, action_type, name FROM automation_rules WHERE is_active = 1",
        null
      )
      
      while (cursor.moveToNext()) {
        val triggerType = cursor.getString(0)
        val operator = cursor.getString(1)
        val thresholdStr = cursor.getString(2)
        val actionType = cursor.getString(3)
        val name = cursor.getString(4)

        val threshold = thresholdStr.toDoubleOrNull() ?: continue
        var isTriggered = false

        if (triggerType == "signal") {
          if (rsrp != null && rsrp != 2147483647) {
            isTriggered = when (operator) {
              "lt" -> rsrp < threshold
              "gt" -> rsrp > threshold
              "eq" -> rsrp == threshold.toInt()
              else -> false
            }
          }
        }

        if (isTriggered) {
          triggerRuleAction(name, triggerType, threshold, actionType)
        }
      }
      cursor.close()
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  private fun triggerRuleAction(ruleName: String, triggerType: String, threshold: Double, actionType: String) {
    if (actionType == "notification" || actionType == "alert_sound") {
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val ruleNotification = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("NetPilot Rule Triggered")
        .setContentText("Rule '$ruleName' fired: $triggerType threshold breached!")
        .setSmallIcon(android.R.drawable.ic_dialog_alert)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setAutoCancel(true)
        .build()
      
      notificationManager.notify(ruleName.hashCode(), ruleNotification)
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
