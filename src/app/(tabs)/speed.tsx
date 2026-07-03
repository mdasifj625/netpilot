import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  Gauge, 
  ArrowDown, 
  ArrowUp, 
  Activity, 
  Clock, 
  History, 
  Zap 
} from "lucide-react-native";

// Import custom native modules and DB
import { 
  startSpeedTest, 
  stopSpeedTest, 
  addPingFinishedListener, 
  addSpeedFinishedListener, 
  addSpeedProgressListener 
} from "../../../modules/network-speed";
import { getCellularDetails } from "../../../modules/cellular-diagnostics";
import { db } from "../../database/db";
import { networkHistory } from "../../database/schema";
import { useAppStore } from "../../store/useAppStore";

type TestStatus = "idle" | "ping" | "download" | "upload" | "finished";

export default function SpeedScreen() {
  const { settings } = useAppStore();
  const [status, setStatus] = useState<TestStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [ping, setPing] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);

  const DOWNLOAD_URL = settings.customDownloadUrl.trim() !== ""
    ? settings.customDownloadUrl.trim()
    : "https://speed.cloudflare.com/__down?bytes=15000000";
  const UPLOAD_URL = settings.customUploadUrl.trim() !== ""
    ? settings.customUploadUrl.trim()
    : "https://speed.cloudflare.com/__up";

  useEffect(() => {
    // Register native event listeners
    const subPing = addPingFinishedListener((event) => {
      setPing(event.pingMs);
      setJitter(event.jitterMs);
      setStatus("download");
      setProgress(0);
    });

    const subProgress = addSpeedProgressListener((event) => {
      setProgress(event.progress);
      if (event.type === "download") {
        setDownloadSpeed(event.speedMbps);
      } else if (event.type === "upload") {
        setUploadSpeed(event.speedMbps);
      }
    });

    const subFinished = addSpeedFinishedListener((event) => {
      if (event.type === "download") {
        setDownloadSpeed(event.averageSpeedMbps);
        setStatus("upload");
        setProgress(0);
      } else if (event.type === "upload") {
        setUploadSpeed(event.averageSpeedMbps);
        setStatus("finished");
        setProgress(1);

        // Capture average speeds and save to database
        saveTestResult(downloadSpeed, event.averageSpeedMbps);
      }
    });

    return () => {
      subPing.remove();
      subProgress.remove();
      subFinished.remove();
      stopSpeedTest();
    };
  }, [downloadSpeed, ping]);

  const saveTestResult = async (dl: number, ul: number) => {
    try {
      const cell = getCellularDetails();
      await db.insert(networkHistory).values({
        timestamp: Date.now(),
        signal: cell?.rsrp ?? null,
        carrier: cell?.carrier ?? "WiFi Link",
        networkType: cell?.networkType ?? "WiFi",
        download: dl,
        upload: ul,
        ping: ping,
        latitude: null,
        longitude: null
      });
      console.log("Speed test record saved successfully.");
    } catch (e) {
      console.error("Failed to save speed test history:", e);
    }
  };

  const handleStartTest = () => {
    if (status !== "idle" && status !== "finished") {
      // Cancel active test
      stopSpeedTest();
      setStatus("idle");
      setProgress(0);
      return;
    }

    // Reset values
    setPing(null);
    setJitter(null);
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setProgress(0);
    setStatus("ping");

    const success = startSpeedTest(DOWNLOAD_URL, UPLOAD_URL);
    if (!success) {
      Alert.alert("Error", "Could not initiate native speed test routine.");
      setStatus("idle");
    }
  };

  // Determine pointer speed values for UI gauge
  const currentSpeed = status === "download" ? downloadSpeed : status === "upload" ? uploadSpeed : status === "finished" ? downloadSpeed : 0;
  const speedLabel = status === "upload" ? "Upload" : "Download";

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-4 py-2">
        {/* Title */}
        <View className="mb-6 mt-4">
          <Text className="text-2xl font-bold text-slate-50">Speed Test</Text>
          <Text className="text-slate-400 text-xs mt-0.5">Multi-threaded OkHttp latency and throughput audit</Text>
        </View>

        {/* Gauge Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 items-center py-10 shadow-lg relative overflow-hidden">
          {/* Animated Glow during active testing */}
          {(status === "download" || status === "upload") && (
            <View className={`absolute top-10 w-44 h-44 rounded-full filter blur-3xl opacity-15 animate-pulse ${status === "download" ? "bg-sky-500" : "bg-indigo-500"}`} />
          )}

          {/* Core Speed Circle */}
          <View className="relative w-52 h-52 justify-center items-center rounded-full border-4 border-slate-800/80 bg-slate-950/50 shadow-inner">
            <Gauge size={48} color={status === "download" ? "#0ea5e9" : status === "upload" ? "#818cf8" : "#475569"} />
            <Text className="text-4xl font-black text-slate-50 mt-2">
              {currentSpeed.toFixed(1)}
            </Text>
            <Text className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">Mbps</Text>
            
            {status !== "idle" && status !== "finished" && (
              <View className="absolute bottom-6 w-32 bg-slate-900 border border-slate-800 h-2 rounded-full overflow-hidden">
                <View 
                  style={{ width: `${progress * 100}%` }}
                  className={`h-full ${status === "download" ? "bg-sky-500" : "bg-indigo-400"}`}
                />
              </View>
            )}

            {status !== "idle" && (
              <Text className="absolute bottom-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {status.toUpperCase()}
              </Text>
            )}
          </View>

          {/* Action Trigger Button */}
          <TouchableOpacity 
            onPress={handleStartTest}
            className={`mt-8 px-12 py-3.5 rounded-full shadow-lg items-center justify-center ${
              status !== "idle" && status !== "finished"
                ? "bg-slate-800 border border-slate-700 active:bg-slate-700"
                : "bg-sky-500 active:bg-sky-600"
            }`}
          >
            <Text className="text-white font-extrabold text-sm uppercase tracking-wider">
              {status !== "idle" && status !== "finished" ? "Cancel Test" : "Start Test"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Speed test metrics details grid */}
        <View className="flex-row flex-wrap gap-4 mb-6">
          {/* Download Speed Card */}
          <View className="flex-1 min-w-[45%] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex-row items-center gap-3">
            <View className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <ArrowDown size={20} color="#0ea5e9" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Download</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {downloadSpeed > 0 ? `${downloadSpeed.toFixed(1)}` : "—"}
                {downloadSpeed > 0 && <Text className="text-xs font-semibold text-slate-400"> Mbps</Text>}
              </Text>
            </View>
          </View>

          {/* Upload Speed Card */}
          <View className="flex-1 min-w-[45%] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex-row items-center gap-3">
            <View className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <ArrowUp size={20} color="#818cf8" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Upload</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {uploadSpeed > 0 ? `${uploadSpeed.toFixed(1)}` : "—"}
                {uploadSpeed > 0 && <Text className="text-xs font-semibold text-slate-400"> Mbps</Text>}
              </Text>
            </View>
          </View>

          {/* Latency Ping Card */}
          <View className="flex-1 min-w-[45%] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex-row items-center gap-3">
            <View className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20">
              <Clock size={20} color="#2dd4bf" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Ping (Latency)</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {ping !== null ? `${ping.toFixed(0)}` : "—"}
                {ping !== null && <Text className="text-xs font-semibold text-slate-400"> ms</Text>}
              </Text>
            </View>
          </View>

          {/* Jitter Card */}
          <View className="flex-1 min-w-[45%] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex-row items-center gap-3">
            <View className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Zap size={20} color="#34d399" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Jitter</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {jitter !== null ? `${jitter.toFixed(1)}` : "—"}
                {jitter !== null && <Text className="text-xs font-semibold text-slate-400"> ms</Text>}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
