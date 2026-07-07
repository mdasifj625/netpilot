package com.superhero.netpilot.lan

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class LanScannerModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    private var isScanning = false

    override fun definition() =
        ModuleDefinition {
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

            AsyncFunction("scanDevicePorts") { ip: String ->
                val openPorts = mutableListOf<Int>()
                val ports =
                    listOf(
                        21,
                        22,
                        23,
                        25,
                        53,
                        80,
                        111,
                        139,
                        443,
                        445,
                        631,
                        3306,
                        3389,
                        5000,
                        5432,
                        5555,
                        6379,
                        8000,
                        8080,
                        8081,
                        8443,
                        27017,
                    )

                // Use a smaller thread pool (4) to avoid triggering router Intrusion Detection Systems (IDS)
                val threadPool = Executors.newFixedThreadPool(4)
                val latch = java.util.concurrent.CountDownLatch(ports.size)

                for (port in ports) {
                    threadPool.execute {
                        try {
                            val socket = java.net.Socket()
                            socket.connect(java.net.InetSocketAddress(ip, port), 800) // 800ms timeout for better accuracy
                            socket.close()
                            synchronized(openPorts) {
                                openPorts.add(port)
                            }
                        } catch (e: Exception) {
                            // Closed or timeout
                        } finally {
                            latch.countDown()
                        }
                    }
                }

                latch.await(20, TimeUnit.SECONDS)
                threadPool.shutdown()

                return@AsyncFunction openPorts.sorted()
            }
        }

    private fun startPingSweep() {
        Executors.newSingleThreadExecutor().execute {
            try {
                val subnet =
                    com.superhero.netpilot.lan.utils.LanScannerHelper
                        .getLocalSubnet(context)
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
                        if (com.superhero.netpilot.lan.utils.LanScannerHelper
                                .isHostReachable(ip)
                        ) {
                            activeDevices.add(ip)
                            val hostname =
                                com.superhero.netpilot.lan.utils.LanScannerHelper
                                    .getHostName(ip)
                            sendEvent(
                                "onDeviceFound",
                                mapOf(
                                    "ip" to ip,
                                    "hostname" to hostname,
                                    "ping" to
                                        com.superhero.netpilot.lan.utils.LanScannerHelper
                                            .getPingTime(ip),
                                ),
                            )
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
}
