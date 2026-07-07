package com.superhero.netpilot.cellular.utils

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat

object TelemetryNotificationHelper {
    const val CHANNEL_ID = "netpilot_telemetry_channel"
    const val NOTIFICATION_ID = 4636

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel =
                NotificationChannel(
                    CHANNEL_ID,
                    "NetPilot Telemetry Service",
                    NotificationManager.IMPORTANCE_LOW,
                ).apply {
                    description = "Provides persistent cellular signal background logging."
                }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    fun buildTelemetryNotification(
        context: Context,
        status: String,
        signal: String,
    ): Notification =
        NotificationCompat
            .Builder(context, CHANNEL_ID)
            .setContentTitle("NetPilot Active")
            .setContentText("$status • $signal")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .build()

    fun updateNotification(
        context: Context,
        status: String,
        signal: String,
    ) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = buildTelemetryNotification(context, status, signal)
        manager.notify(NOTIFICATION_ID, notification)
    }
}
