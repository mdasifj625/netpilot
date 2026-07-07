package com.superhero.netpilot.cellular

import android.app.Notification
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.IBinder
import android.telephony.TelephonyManager
import com.superhero.netpilot.cellular.utils.CellularSignalHelper
import com.superhero.netpilot.cellular.utils.TelemetryNotificationHelper
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import kotlin.math.abs

class BackgroundService :
    Service(),
    SensorEventListener {
    companion object {
        private const val NOTIFICATION_ID = TelemetryNotificationHelper.NOTIFICATION_ID
    }

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

    private val locationListener =
        object : LocationListener {
            override fun onLocationChanged(location: Location) {
                currentLocation = location
            }

            override fun onStatusChanged(
                provider: String?,
                status: Int,
                extras: Bundle?,
            ) {}

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

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
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

    override fun onBind(intent: Intent?): IBinder? = null

    private fun initializeSensor() {
        try {
            sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
            accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
            sensorManager?.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_NORMAL)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onAccuracyChanged(
        sensor: Sensor?,
        accuracy: Int,
    ) {}

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
        TelemetryNotificationHelper.createNotificationChannel(this)
    }

    private fun buildTelemetryNotification(
        status: String,
        signal: String,
    ): Notification = TelemetryNotificationHelper.buildTelemetryNotification(this, status, signal)

    private fun updateNotification(
        status: String,
        signal: String,
    ) {
        TelemetryNotificationHelper.updateNotification(this, status, signal)
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
                locationListener,
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

    private fun writeLogToDatabase(
        carrier: String,
        networkType: String,
        rsrp: Int?,
        location: Location?,
    ) {
        val db = database ?: return
        try {
            val values =
                ContentValues().apply {
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

    private fun getRSRP(tm: TelephonyManager): Int? = CellularSignalHelper.getRSRP(tm)

    private fun getNetworkTypeName(type: Int): String = CellularSignalHelper.getNetworkTypeName(type)
}
