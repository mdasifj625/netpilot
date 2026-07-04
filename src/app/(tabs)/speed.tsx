import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { desc, isNotNull } from "drizzle-orm";
import { 
  ArrowDown, 
  ArrowUp, 
  Clock, 
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
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";

const Speedometer = ({ speed }: { speed: number }) => {
  const maxSpeed = 160;
  const angle = -135 + Math.min(1, speed / maxSpeed) * 270;
  const ticks = [0, 20, 40, 60, 80, 100, 120, 140, 160];
  const labelTicks = [0, 40, 80, 120, 160];

  const getTickCoords = (value: number, radius: number) => {
    const tickAngle = -135 + (value / maxSpeed) * 270;
    const angleRad = (tickAngle - 90) * Math.PI / 180;
    return {
      x: 120 + radius * Math.cos(angleRad),
      y: 120 + radius * Math.sin(angleRad)
    };
  };

  return (
    <View className="items-center justify-center relative my-4">
      <Svg width="240" height="240" viewBox="0 0 240 240">
        <Defs>
          <LinearGradient id="speedGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#0ea5e9" />
            <Stop offset="50%" stopColor="#818cf8" />
            <Stop offset="100%" stopColor="#ec4899" />
          </LinearGradient>
          <LinearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#1e293b" stopOpacity={0.8} />
            <Stop offset="100%" stopColor="#0f172a" stopOpacity={0.8} />
          </LinearGradient>
        </Defs>

        {/* Outer Background Track Arc */}
        <Circle
          cx="120"
          cy="120"
          r="95"
          stroke="url(#trackGrad)"
          strokeWidth="12"
          fill="none"
          strokeDasharray="447.67 149.22"
          transform="rotate(135, 120, 120)"
          strokeLinecap="round"
        />

        {/* Active Speed Arc */}
        <Circle
          cx="120"
          cy="120"
          r="95"
          stroke="url(#speedGrad)"
          strokeWidth="12"
          fill="none"
          strokeDasharray="447.67 149.22"
          strokeDashoffset={447.67 - Math.min(1, speed / maxSpeed) * 447.67}
          transform="rotate(135, 120, 120)"
          strokeLinecap="round"
        />

        {/* Inner subtle rim */}
        <Circle
          cx="120"
          cy="120"
          r="78"
          stroke="#1e293b"
          strokeWidth="1"
          fill="none"
          strokeDasharray="367.57 122.52"
          transform="rotate(135, 120, 120)"
        />

        {/* Ticks */}
        {ticks.map((val) => {
          const startCoords = getTickCoords(val, 84);
          const endCoords = getTickCoords(val, 91);
          const isActive = speed >= val && speed > 0;
          return (
            <Line
              key={val}
              x1={startCoords.x.toString()}
              y1={startCoords.y.toString()}
              x2={endCoords.x.toString()}
              y2={endCoords.y.toString()}
              stroke={isActive ? "#38bdf8" : "#334155"}
              strokeWidth={isActive ? "2.5" : "1.5"}
            />
          );
        })}

        {/* Label numbers inside the gauge */}
        {labelTicks.map((val) => {
          const coords = getTickCoords(val, 64);
          const isActive = speed >= val && speed > 0;
          return (
            <SvgText
              key={val}
              x={coords.x.toString()}
              y={(coords.y + 3.5).toString()} // small offset to vertically center text
              fill={isActive ? "#f8fafc" : "#475569"}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              {val}
            </SvgText>
          );
        })}

        {/* Needle pointer */}
        <Path
          d="M 116 120 L 120 32 L 124 120 Z"
          fill="#38bdf8"
          transform={`rotate(${angle}, 120, 120)`}
          stroke="#0284c7"
          strokeWidth="0.5"
        />

        {/* Center Hub */}
        <Circle cx="120" cy="120" r="14" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
        <Circle cx="120" cy="120" r="4" fill="#38bdf8" />
      </Svg>

      {/* Speedometer text readout */}
      <View className="absolute bottom-8 items-center">
        <Text className="text-3xl font-black text-slate-50">{speed.toFixed(1)}</Text>
        <Text className="text-slate-500 font-bold text-[9px] uppercase tracking-widest mt-0.5">Mbps</Text>
      </View>
    </View>
  );
};

const SpeedHistoryChart = ({ data }: { data: any[] }) => {
  if (data.length === 0) {
    return (
      <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 items-center justify-center py-10 shadow-md">
        <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">No Speed History Yet</Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map(d => Math.max(d.download || 10, d.upload || 10)), 10);

  return (
    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
      <Text className="text-sm font-bold text-slate-200 mb-4">Throughput Trends (Last 10 Tests)</Text>
      
      <View className="flex-row items-end justify-between h-32 pt-2 px-2 relative border-b border-slate-800">
        {data.map((item, idx) => {
          const dlHeight = Math.min(100, Math.round(((item.download || 0) / maxVal) * 100));
          const ulHeight = Math.min(100, Math.round(((item.upload || 0) / maxVal) * 100));
          
          return (
            <View key={item.id || idx} className="items-center flex-1 mx-1.5" style={{ gap: 2 }}>
              <View className="flex-row items-end h-24 gap-1 w-full justify-center">
                <View 
                  style={{ height: `${dlHeight}%` }}
                  className="w-2.5 bg-sky-500 rounded-t-sm"
                />
                <View 
                  style={{ height: `${ulHeight}%` }}
                  className="w-2.5 bg-indigo-400 rounded-t-sm"
                />
              </View>
              <Text className="text-[8px] text-slate-500 font-bold mt-1">#{data.length - idx}</Text>
            </View>
          );
        })}
      </View>
      <View className="flex-row gap-4 mt-3 justify-center">
        <View className="flex-row items-center gap-1.5">
          <View className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
          <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Download</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2.5 h-2.5 rounded-sm bg-indigo-400" />
          <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Upload</Text>
        </View>
      </View>
    </View>
  );
};

type TestStatus = "idle" | "ping" | "download" | "upload" | "finished";

export default function SpeedScreen() {
  const { settings } = useAppStore();
  const [status, setStatus] = useState<TestStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [ping, setPing] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);

  const fetchSpeedHistory = async () => {
    try {
      const list = await db
        .select()
        .from(networkHistory)
        .where(isNotNull(networkHistory.download))
        .orderBy(desc(networkHistory.timestamp))
        .limit(10);
      setHistory(list.reverse());
    } catch (e) {
      console.error("Failed to query speed test history:", e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchSpeedHistory();
    }, [])
  );

  const DOWNLOAD_URL = settings.customDownloadUrl.trim() !== ""
    ? settings.customDownloadUrl.trim()
    : "https://speed.cloudflare.com/__down?bytes=15000000";
  const UPLOAD_URL = settings.customUploadUrl.trim() !== ""
    ? settings.customUploadUrl.trim()
    : "https://speed.cloudflare.com/__up";

  useEffect(() => {
    // Register native or fallback JS event listeners
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

  const saveTestResult = async (finalDownload: number, finalUpload: number) => {
    try {
      let cellCarrier = "WiFi Link";
      let connType = "WiFi";

      // Safely access cellular details on native platforms
      if (Platform.OS !== "web") {
        try {
          const cell = getCellularDetails();
          cellCarrier = cell?.carrier ?? "WiFi Link";
          connType = cell?.networkType ?? "WiFi";
        } catch (err) {
          // ignore
        }
      }

      const finalPing = ping;
      // Save speed test to local database
      await db.insert(networkHistory).values({
        timestamp: Date.now(),
        signal: null,
        carrier: cellCarrier,
        networkType: connType,
        download: finalDownload,
        upload: finalUpload,
        ping: finalPing,
        latitude: null,
        longitude: null,
      });
      fetchSpeedHistory();
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

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#020617" }} className="flex-1 bg-slate-950">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }} className="flex-1 px-4 py-2">
        {/* Title */}
        <View className="mb-6 mt-4">
          <Text className="text-2xl font-bold text-slate-50">Speed Test</Text>
          <Text className="text-slate-400 text-xs mt-0.5">Multi-threaded latency and throughput audit</Text>
        </View>

        {/* Gauge Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 items-center py-8 shadow-lg relative overflow-hidden">
          {/* Animated Glow during active testing */}
          {(status === "download" || status === "upload") && (
            <View className={`absolute top-10 w-44 h-44 rounded-full filter blur-3xl opacity-15 ${status === "download" ? "bg-sky-500" : "bg-indigo-500"}`} />
          )}

          {/* Core Speedometer Gauge */}
          <Speedometer speed={currentSpeed} />

          {status !== "idle" && status !== "finished" && (
            <View className="w-44 bg-slate-950 border border-slate-800 h-2.5 rounded-full overflow-hidden mt-3 shadow-inner">
              <View 
                style={{ width: `${progress * 100}%` }}
                className={`h-full ${status === "download" ? "bg-sky-500" : "bg-indigo-400"}`}
              />
            </View>
          )}

          {status !== "idle" && (
            <Text className="text-[10px] font-black text-sky-400 uppercase tracking-widest mt-2">
              {status.toUpperCase()}
            </Text>
          )}

          {/* Action Trigger Button */}
          <TouchableOpacity 
            onPress={handleStartTest}
            className={`mt-6 px-12 py-3.5 rounded-full shadow-lg items-center justify-center ${
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

        {/* Speed Test History Chart */}
        <SpeedHistoryChart data={history} />
      </ScrollView>
    </SafeAreaView>
  );
}
