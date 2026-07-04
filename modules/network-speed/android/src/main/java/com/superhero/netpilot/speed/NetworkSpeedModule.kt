package com.superhero.netpilot.speed

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.abs

class NetworkSpeedModule : Module() {
    private val context: Context?
        get() = appContext.reactContext

    private val client =
        OkHttpClient
            .Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val original = chain.request()
                val request =
                    original
                        .newBuilder()
                        .header(
                            "User-Agent",
                            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                        ).header("Referer", "https://speed.cloudflare.com/")
                        .header("Origin", "https://speed.cloudflare.com")
                        .build()
                chain.proceed(request)
            }.build()

    private var isRunning = false
    private val executor = Executors.newSingleThreadExecutor()

    override fun definition() =
        ModuleDefinition {
            Name("NetworkSpeed")

            Events("onSpeedTestProgress", "onSpeedTestFinished", "onPingFinished", "onPingProgress")

            Function("startSpeedTest") { downloadUrl: String, uploadUrl: String ->
                if (isRunning) return@Function false
                isRunning = true
                runSpeedTest(downloadUrl, uploadUrl)
                return@Function true
            }

            Function("stopSpeedTest") {
                isRunning = false
                return@Function true
            }
        }

    private fun runSpeedTest(
        downloadUrl: String,
        uploadUrl: String,
    ) {
        executor.execute {
            try {
                // Step 1: Ping & Jitter Test
                runPingTest(downloadUrl)

                if (!isRunning) return@execute

                // Step 2: Download Test
                runDownloadTest(downloadUrl)

                if (!isRunning) return@execute

                // Step 3: Upload Test
                runUploadTest(uploadUrl)
            } catch (e: Exception) {
                // Ignore
            } finally {
                isRunning = false
            }
        }
    }

    private fun runPingTest(url: String) {
        val latencies = mutableListOf<Long>()
        // If the url has query params, just ping the root domain or the base url to avoid download trigger
        val pingUrl =
            try {
                val parsed = url.toHttpUrlOrNull()
                if (parsed != null) {
                    HttpUrl
                        .Builder()
                        .scheme(parsed.scheme)
                        .host(parsed.host)
                        .port(parsed.port)
                        .build()
                        .toString()
                } else {
                    url
                }
            } catch (e: Exception) {
                url
            }

        val request =
            Request
                .Builder()
                .url(pingUrl)
                .head()
                .build()

        for (i in 1..5) {
            if (!isRunning) return
            val start = System.nanoTime()
            var currentPing = -1.0
            try {
                client.newCall(request).execute().use { response ->
                    val end = System.nanoTime()
                    val latency = (end - start) / 1_000_000
                    latencies.add(latency)
                    currentPing = latency.toDouble()
                }
            } catch (e: IOException) {
                // Ignore
            }

            sendEvent(
                "onPingProgress",
                mapOf(
                    "pingMs" to if (currentPing >= 0) currentPing else -1.0,
                    "progress" to (i.toFloat() / 5.0f),
                ),
            )

            Thread.sleep(150)
        }

        if (latencies.isNotEmpty()) {
            val ping = latencies.average()
            var jitterSum = 0.0
            if (latencies.size > 1) {
                for (i in 0 until latencies.size - 1) {
                    jitterSum += abs(latencies[i + 1] - latencies[i])
                }
                val jitter = jitterSum / (latencies.size - 1)
                sendEvent("onPingFinished", mapOf("pingMs" to ping, "jitterMs" to jitter))
            } else {
                sendEvent("onPingFinished", mapOf("pingMs" to ping, "jitterMs" to 0.0))
            }
        } else {
            sendEvent("onPingFinished", mapOf("pingMs" to -1.0, "jitterMs" to -1.0))
        }
    }

    private fun isWifiConnection(): Boolean {
        val ctx = context ?: return false
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val activeNetwork = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }

    private fun runDownloadTest(url: String) {
        val isWifi = isWifiConnection()
        val threadCount = if (isWifi) 8 else 4
        val downloadExecutor = Executors.newFixedThreadPool(threadCount)

        val totalBytesRead = AtomicLong(0L)
        val startTime = System.currentTimeMillis()
        val durationLimit = 8000 // 8 seconds test duration limit
        val latch = CountDownLatch(threadCount)

        try {
            // Spawn multiple parallel download streams
            for (i in 0 until threadCount) {
                downloadExecutor.execute {
                    try {
                        val request = Request.Builder().url(url).build()
                        client.newCall(request).execute().use { response ->
                            if (response.isSuccessful) {
                                val body = response.body
                                if (body != null) {
                                    val inputStream: InputStream = body.byteStream()
                                    val buffer = ByteArray(16384) // 16KB stream chunk read buffer
                                    var bytesRead: Int
                                    while (inputStream.read(buffer).also { bytesRead = it } != -1 && isRunning) {
                                        totalBytesRead.addAndGet(bytesRead.toLong())
                                        val elapsed = System.currentTimeMillis() - startTime
                                        if (elapsed >= durationLimit) break
                                    }
                                }
                            } else {
                                Log.e("NetworkSpeed", "Download stream failed with status: ${response.code}")
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("NetworkSpeed", "Download stream exception", e)
                    } finally {
                        latch.countDown()
                    }
                }
            }

            // Monitor progress and report updates to JS thread
            var lastUpdate = System.currentTimeMillis()
            while (isRunning) {
                val now = System.currentTimeMillis()
                val elapsed = now - startTime

                if (elapsed >= durationLimit || latch.count == 0L) {
                    break
                }

                if (now - lastUpdate > 150) {
                    val speedMbps = calculateSpeedMbps(totalBytesRead.get(), elapsed)
                    val progress = elapsed.toFloat() / durationLimit
                    sendEvent(
                        "onSpeedTestProgress",
                        mapOf(
                            "type" to "download",
                            "speedMbps" to speedMbps,
                            "progress" to progress,
                        ),
                    )
                    lastUpdate = now
                }
                Thread.sleep(100)
            }

            // Clean up and shutdown executors
            downloadExecutor.shutdownNow()
            try {
                downloadExecutor.awaitTermination(2, TimeUnit.SECONDS)
            } catch (e: Exception) {
            }

            val finalElapsed = System.currentTimeMillis() - startTime
            val finalSpeed = calculateSpeedMbps(totalBytesRead.get(), finalElapsed)
            sendEvent(
                "onSpeedTestFinished",
                mapOf(
                    "type" to "download",
                    "averageSpeedMbps" to finalSpeed,
                ),
            )
        } catch (e: Exception) {
            Log.e("NetworkSpeed", "Download test overall error", e)
            sendEvent("onSpeedTestFinished", mapOf("type" to "download", "averageSpeedMbps" to 0.0))
        }
    }

    private fun runUploadTest(url: String) {
        val sizeInBytes = 25 * 1024 * 1024 // 25MB buffer to avoid running out of bytes quickly
        val uploadBuffer = ByteArray(16384)
        val totalBytesWritten = AtomicLong(0L)
        val startTime = System.currentTimeMillis()
        val durationLimit = 8000

        val requestBody =
            object : RequestBody() {
                override fun contentType(): MediaType? = "application/octet-stream".toMediaTypeOrNull()

                override fun contentLength(): Long = -1L // use chunked encoding to avoid ProtocolException on early exit

                override fun writeTo(sink: okio.BufferedSink) {
                    val bodyStartTime = System.currentTimeMillis()
                    var lastUpdate = System.currentTimeMillis()
                    val chunkSize = 16384

                    while (isRunning) {
                        val now = System.currentTimeMillis()
                        val elapsed = now - bodyStartTime
                        if (elapsed >= durationLimit) break

                        sink.write(uploadBuffer, 0, chunkSize)
                        sink.flush()
                        totalBytesWritten.addAndGet(chunkSize.toLong())

                        if (now - lastUpdate > 150) {
                            val speedMbps = calculateSpeedMbps(totalBytesWritten.get(), elapsed)
                            val progress = elapsed.toFloat() / durationLimit
                            sendEvent(
                                "onSpeedTestProgress",
                                mapOf(
                                    "type" to "upload",
                                    "speedMbps" to speedMbps,
                                    "progress" to progress,
                                ),
                            )
                            lastUpdate = now
                        }
                    }
                }
            }

        val request =
            Request
                .Builder()
                .url(url)
                .post(requestBody)
                .build()
        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val finalElapsed = System.currentTimeMillis() - startTime
                    val finalSpeed = calculateSpeedMbps(totalBytesWritten.get(), finalElapsed)
                    sendEvent(
                        "onSpeedTestFinished",
                        mapOf(
                            "type" to "upload",
                            "averageSpeedMbps" to finalSpeed,
                        ),
                    )
                } else {
                    Log.e("NetworkSpeed", "Upload request failed with status: ${response.code}")
                    throw IOException("Upload failed with status code ${response.code}")
                }
            }
        } catch (e: Exception) {
            Log.e("NetworkSpeed", "Upload test overall error", e)
            val finalElapsed = System.currentTimeMillis() - startTime
            val finalSpeed = calculateSpeedMbps(totalBytesWritten.get(), finalElapsed)
            sendEvent(
                "onSpeedTestFinished",
                mapOf(
                    "type" to "upload",
                    "averageSpeedMbps" to if (finalSpeed > 0) finalSpeed else 0.0,
                ),
            )
        }
    }

    private fun calculateSpeedMbps(
        bytes: Long,
        timeMs: Long,
    ): Double {
        if (timeMs <= 0) return 0.0
        val megabits = (bytes * 8.0) / 1_000_000.0
        val seconds = timeMs / 1000.0
        return megabits / seconds
    }
}
