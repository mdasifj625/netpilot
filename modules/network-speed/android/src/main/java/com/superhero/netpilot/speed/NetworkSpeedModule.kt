package com.superhero.netpilot.speed

import okhttp3.*
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NetworkSpeedModule : Module() {
  private val client = OkHttpClient.Builder()
    .connectTimeout(5, TimeUnit.SECONDS)
    .readTimeout(10, TimeUnit.SECONDS)
    .build()

  private var isRunning = false
  private val executor = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("NetworkSpeed")

    Events("onSpeedTestProgress", "onSpeedTestFinished", "onPingFinished")

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

  private fun runSpeedTest(downloadUrl: String, uploadUrl: String) {
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
    val request = Request.Builder().url(url).head().build()
    
    for (i in 1..5) {
      if (!isRunning) return
      val start = System.nanoTime()
      try {
        client.newCall(request).execute().use { response ->
          if (response.isSuccessful) {
            val end = System.nanoTime()
            latencies.add((end - start) / 1_000_000)
          }
        }
      } catch (e: IOException) {
        // Ignore
      }
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

  private fun runDownloadTest(url: String) {
    val request = Request.Builder().url(url).build()
    try {
      client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) throw IOException("Failed to download file: $response")
        val body = response.body ?: return
        val inputStream: InputStream = body.byteStream()
        
        val buffer = ByteArray(16384) // 16KB buffer
        var bytesRead: Int
        var totalBytesRead = 0L
        val startTime = System.currentTimeMillis()
        val durationLimit = 8000 // 8 seconds test
        
        var lastUpdate = System.currentTimeMillis()

        while (inputStream.read(buffer).also { bytesRead = it } != -1 && isRunning) {
          totalBytesRead += bytesRead
          val now = System.currentTimeMillis()
          val elapsed = now - startTime
          
          if (elapsed >= durationLimit) break

          if (now - lastUpdate > 150) {
            val speedMbps = calculateSpeedMbps(totalBytesRead, elapsed)
            val progress = elapsed.toFloat() / durationLimit
            sendEvent("onSpeedTestProgress", mapOf(
              "type" to "download",
              "speedMbps" to speedMbps,
              "progress" to progress
            ))
            lastUpdate = now
          }
        }
        
        val finalElapsed = System.currentTimeMillis() - startTime
        val finalSpeed = calculateSpeedMbps(totalBytesRead, finalElapsed)
        sendEvent("onSpeedTestFinished", mapOf(
          "type" to "download",
          "averageSpeedMbps" to finalSpeed
        ))
      }
    } catch (e: Exception) {
      sendEvent("onSpeedTestFinished", mapOf("type" to "download", "averageSpeedMbps" to 0.0))
    }
  }

  private fun runUploadTest(url: String) {
    val sizeInBytes = 25 * 1024 * 1024 // 25MB buffer to avoid running out of bytes quickly
    val uploadBuffer = ByteArray(16384)

    val requestBody = object : RequestBody() {
      override fun contentType(): MediaType? = MediaType.parse("application/octet-stream")
      override fun contentLength(): Long = sizeInBytes.toLong()

      override fun writeTo(sink: okio.BufferedSink) {
        val startTime = System.currentTimeMillis()
        val durationLimit = 8000
        var totalBytesWritten = 0L
        val chunkSize = 16384
        var lastUpdate = System.currentTimeMillis()

        while (totalBytesWritten < sizeInBytes && isRunning) {
          val now = System.currentTimeMillis()
          val elapsed = now - startTime
          if (elapsed >= durationLimit) break

          val toWrite = minOf(chunkSize.toLong(), sizeInBytes - totalBytesWritten).toInt()
          sink.write(uploadBuffer, 0, toWrite)
          totalBytesWritten += toWrite

          if (now - lastUpdate > 150) {
            val speedMbps = calculateSpeedMbps(totalBytesWritten, elapsed)
            val progress = elapsed.toFloat() / durationLimit
            sendEvent("onSpeedTestProgress", mapOf(
              "type" to "upload",
              "speedMbps" to speedMbps,
              "progress" to progress
            ))
            lastUpdate = now
          }
        }
      }
    }

    val request = Request.Builder().url(url).post(requestBody).build()
    val startTime = System.currentTimeMillis()
    try {
      client.newCall(request).execute().use { response ->
        val finalElapsed = System.currentTimeMillis() - startTime
        val finalSpeed = calculateSpeedMbps(sizeInBytes.toLong(), finalElapsed)
        sendEvent("onSpeedTestFinished", mapOf(
          "type" to "upload",
          "averageSpeedMbps" to finalSpeed
        ))
      }
    } catch (e: Exception) {
      val finalElapsed = System.currentTimeMillis() - startTime
      val finalSpeed = calculateSpeedMbps(sizeInBytes.toLong(), finalElapsed)
      sendEvent("onSpeedTestFinished", mapOf(
        "type" to "upload",
        "averageSpeedMbps" to if (finalSpeed > 0) finalSpeed else 0.0
      ))
    }
  }

  private fun calculateSpeedMbps(bytes: Long, timeMs: Long): Double {
    if (timeMs <= 0) return 0.0
    val megabits = (bytes * 8.0) / 1_000_000.0
    val seconds = timeMs / 1000.0
    return megabits / seconds
  }
}
