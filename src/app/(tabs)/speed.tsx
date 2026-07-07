import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Animated, Switch } from "react-native";
import { ArrowDown, ArrowUp, Clock, Zap, Settings, ChevronDown, ChevronUp } from "lucide-react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { Speedometer } from "../../features/speed/components/Speedometer";
import { Sparkline, RadarChart, SpeedHistoryChart } from "../../features/speed/components/Charts";
import { useSpeedViewModel } from "../../features/speed/useSpeedViewModel";
import { useAppStore } from "../../store/useAppStore";

const TEST_SERVERS = [
  {
    id: "cloudflare-auto",
    name: "Cloudflare (Auto Nearest)",
    dl: "https://speed.cloudflare.com/__down?bytes=250000000",
    ul: "https://speed.cloudflare.com/__up",
  },
  {
    id: "aws-edge",
    name: "AWS Edge (Mock)",
    dl: "https://speed.cloudflare.com/__down?bytes=250000000",
    ul: "https://speed.cloudflare.com/__up",
  },
  {
    id: "fastly-edge",
    name: "Fastly CDN (Mock)",
    dl: "https://speed.cloudflare.com/__down?bytes=250000000",
    ul: "https://speed.cloudflare.com/__up",
  },
];

const getTargetMax = (currentSpeed: number) => {
  let max = 100;
  while (currentSpeed >= max * 0.9 && max < 1000) {
    max += 100;
  }
  return max;
};

export default function SpeedScreen() {
  const {
    settings,
    status,
    isAdvancedExpanded,
    setIsAdvancedExpanded,
    handleToggleMultiConnection,
    progress,
    ping,
    jitter,
    downloadSpeed,
    uploadSpeed,
    history,
    downloadHistory,
    uploadHistory,
    networkInfo,
    pulseAnim,
    fadeAnim,
    clearHistory,
    handleStartTest,
    currentSpeed,
  } = useSpeedViewModel();

  const { updateSettings } = useAppStore();

  return (
    <View style={{ flex: 1 }} className="flex-1">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
        className="flex-1"
      >
        {/* Compact Gauge Card */}
        <View className="bg-slate-900/80 border border-slate-800/80 rounded-[32px] p-4 mb-5 items-center shadow-lg relative overflow-hidden backdrop-blur-md">
          {/* Animated Glow during active testing */}
          {(status === "download" || status === "upload") && (
            <View className="absolute top-10 w-44 h-44 opacity-20">
              <Svg height="100%" width="100%">
                <Defs>
                  <RadialGradient id="mainGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor={status === "download" ? "#0ea5e9" : "#ec4899"} stopOpacity="1" />
                    <Stop offset="100%" stopColor={status === "download" ? "#0ea5e9" : "#ec4899"} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx="50%" cy="50%" r="50%" fill="url(#mainGlow)" />
              </Svg>
            </View>
          )}

          {/* Core Speedometer Gauge */}
          <View className="scale-[0.85] -my-4">
            <Speedometer speed={currentSpeed} />
          </View>

          {status !== "idle" && status !== "finished" && (
            <View className="w-44 h-8 items-center justify-center -mt-2">
              {status === "download" && downloadHistory.length > 0 ? (
                <Sparkline data={downloadHistory} color="#0ea5e9" max={getTargetMax(currentSpeed)} />
              ) : status === "upload" && uploadHistory.length > 0 ? (
                <Sparkline data={uploadHistory} color="#ec4899" max={getTargetMax(currentSpeed)} />
              ) : (
                <View className="w-full bg-slate-950 border border-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                  <View
                    style={{ width: `${progress * 100}%` }}
                    className={`h-full ${status === "download" ? "bg-sky-500" : "bg-pink-500"}`}
                  />
                </View>
              )}
            </View>
          )}

          {status !== "idle" && status !== "finished" && (
            <Text className="text-[10px] font-black text-sky-400 uppercase tracking-widest mt-3">
              {status.toUpperCase()}
            </Text>
          )}

          {/* Action Trigger Button */}
          <TouchableOpacity
            onPress={handleStartTest}
            className={`mt-3 px-10 py-3 rounded-full shadow-lg items-center justify-center ${
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
        <View className="flex-row flex-wrap gap-4 mb-5">
          {/* Download Speed Card */}
          <Animated.View
            style={{
              borderColor:
                status === "download" ? "#0ea5e9" : status === "finished" ? "rgba(14, 165, 233, 0.4)" : "#1e293b",
              opacity: status === "download" ? pulseAnim : 1.0,
              borderWidth: 1,
            }}
            className="flex-1 min-w-[45%] bg-slate-900 rounded-2xl p-4 shadow-md flex-row items-center gap-3"
          >
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
          </Animated.View>

          {/* Upload Speed Card */}
          <Animated.View
            style={{
              borderColor:
                status === "upload" ? "#ec4899" : status === "finished" ? "rgba(236, 72, 153, 0.4)" : "#1e293b",
              opacity: status === "upload" ? pulseAnim : 1.0,
              borderWidth: 1,
            }}
            className="flex-1 min-w-[45%] bg-slate-900 rounded-2xl p-4 shadow-md flex-row items-center gap-3"
          >
            <View className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20">
              <ArrowUp size={20} color="#ec4899" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Upload</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {uploadSpeed > 0 ? `${uploadSpeed.toFixed(1)}` : "—"}
                {uploadSpeed > 0 && <Text className="text-xs font-semibold text-slate-400"> Mbps</Text>}
              </Text>
            </View>
          </Animated.View>

          {/* Latency Ping Card */}
          <Animated.View
            style={{
              borderColor:
                status === "ping" ? "#2dd4bf" : status === "finished" ? "rgba(45, 212, 191, 0.4)" : "#1e293b",
              opacity: status === "ping" ? pulseAnim : 1.0,
              borderWidth: 1,
            }}
            className="flex-1 min-w-[45%] bg-slate-900 rounded-2xl p-4 shadow-md flex-row items-center gap-3"
          >
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
          </Animated.View>

          {/* Jitter Card */}
          <Animated.View
            style={{
              borderColor:
                status === "ping" ? "#34d399" : status === "finished" ? "rgba(52, 211, 153, 0.4)" : "#1e293b",
              opacity: status === "ping" ? pulseAnim : 1.0,
              borderWidth: 1,
            }}
            className="flex-1 min-w-[45%] bg-slate-900 rounded-2xl p-4 shadow-md flex-row items-center gap-3"
          >
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
          </Animated.View>
        </View>

        {/* Network Info Footer */}
        <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex-row justify-between mb-5">
          <View>
            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">Your Network</Text>
            <Text className="text-slate-200 text-sm font-semibold">{networkInfo?.isp || "Fetching ISP..."}</Text>
            <Text className="text-slate-400 text-xs mt-0.5">{networkInfo?.ip || "—"}</Text>
          </View>
          <View className="items-end">
            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">Test Server</Text>
            <Text className="text-sky-400 text-sm font-semibold">
              {settings.selectedServerId === "aws-edge"
                ? "AWS Edge"
                : settings.selectedServerId === "fastly-edge"
                  ? "Fastly CDN"
                  : "Cloudflare Edge"}
            </Text>
            <Text className="text-slate-400 text-xs mt-0.5">Auto / Nearest</Text>
          </View>
        </View>

        {/* Expandable Advanced Options */}
        <View className="bg-slate-900/60 border border-slate-800/60 rounded-2xl mb-5 overflow-hidden">
          <TouchableOpacity
            onPress={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
            className="p-4 flex-row justify-between items-center bg-slate-900"
          >
            <View className="flex-row items-center gap-2">
              <Settings size={16} color="#818cf8" />
              <Text className="text-sm font-bold text-slate-300">Advanced Configuration</Text>
            </View>
            {isAdvancedExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
          </TouchableOpacity>

          {isAdvancedExpanded && (
            <View className="p-4 pt-1 border-t border-slate-800/40" style={{ gap: 12 }}>
              <View className="flex-row justify-between items-center py-1">
                <View className="flex-1 pr-4">
                  <Text className="text-slate-300 font-semibold text-xs">Multi Connection</Text>
                  <Text className="text-slate-500 text-[10px] mt-0.5 leading-relaxed">
                    Use multiple simultaneous streams to maximize throughput, or single stream to diagnose throttling.
                  </Text>
                </View>
                <Switch
                  value={settings.isMultiConnection}
                  onValueChange={handleToggleMultiConnection}
                  trackColor={{ false: "#1e293b", true: "#818cf8" }}
                  thumbColor={settings.isMultiConnection ? "#f8fafc" : "#64748b"}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>

              <View className="mt-1 pt-3 border-t border-slate-800/40">
                <Text className="text-slate-500 text-[9px] uppercase font-bold tracking-wider mb-2">
                  Select Edge Server
                </Text>
                <View style={{ gap: 6 }}>
                  {TEST_SERVERS.map((srv) => (
                    <TouchableOpacity
                      key={srv.id}
                      onPress={() =>
                        updateSettings({ selectedServerId: srv.id, customDownloadUrl: srv.dl, customUploadUrl: srv.ul })
                      }
                      className={`px-3 py-2 rounded-lg border ${
                        settings.selectedServerId === srv.id
                          ? "bg-indigo-500/10 border-indigo-500/40"
                          : "bg-slate-950/40 border-slate-800/60"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${settings.selectedServerId === srv.id ? "text-indigo-400" : "text-slate-400"}`}
                      >
                        {srv.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Audit Completion rating summary Card */}
        {status === "finished" && (
          <Animated.View
            style={{ opacity: fadeAnim }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden"
          >
            {/* Background rating highlight glow */}
            <View className="absolute -right-10 -top-10 w-24 h-24 opacity-20">
              <Svg height="100%" width="100%">
                <Defs>
                  <RadialGradient id="cardGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor={downloadSpeed > uploadSpeed ? "#0ea5e9" : "#ec4899"} stopOpacity="1" />
                    <Stop
                      offset="100%"
                      stopColor={downloadSpeed > uploadSpeed ? "#0ea5e9" : "#ec4899"}
                      stopOpacity="0"
                    />
                  </RadialGradient>
                </Defs>
                <Circle cx="50%" cy="50%" r="50%" fill="url(#cardGlow)" />
              </Svg>
            </View>

            <View className="flex-row items-center gap-2 mb-2">
              <View className="p-1 rounded bg-slate-950 border border-slate-800">
                <Text className="text-[10px]">🏆</Text>
              </View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Rating</Text>
            </View>

            <RadarChart down={downloadSpeed} up={uploadSpeed} ping={ping ?? 0} jitter={jitter ?? 0} />

            <Text
              className={`text-sm font-black mt-1 ${
                downloadSpeed > 100
                  ? "text-emerald-400"
                  : downloadSpeed > 50
                    ? "text-sky-400"
                    : downloadSpeed > 15
                      ? "text-indigo-400"
                      : "text-amber-500"
              }`}
            >
              {downloadSpeed > 100
                ? "Excellent Connection"
                : downloadSpeed > 50
                  ? "Good Connection"
                  : downloadSpeed > 15
                    ? "Standard Connection"
                    : "Poor Connection"}
            </Text>
            <Text className="text-[10px] text-slate-400 mt-2 leading-4 font-semibold">
              {downloadSpeed > 100
                ? "Your network delivers ultra-fast download bandwidth and low latency. Ideal for intensive tasks like 4K/8K streaming, competitive gaming, and bulk file sharing."
                : downloadSpeed > 50
                  ? "Your network is fast and stable. Great for multiple HD video streams, clear video calls, and standard cloud backups."
                  : downloadSpeed > 15
                    ? "Your network provides basic broadband speeds. Suitable for daily web browsing, emails, and single-device streaming."
                    : "Your network speed is currently constrained. You might experience buffering during high-definition video playback or multi-party video calls."}
            </Text>
          </Animated.View>
        )}

        {/* Speed Test History Chart */}
        <SpeedHistoryChart data={history} />

        {/* Speed Test History List */}
        {history.length > 0 && (
          <View style={{ gap: 10 }} className="mb-5">
            <View className="flex-row justify-between items-center px-1">
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Detailed Logs History
              </Text>
              <TouchableOpacity onPress={clearHistory} className="px-2 py-1 opacity-50 active:opacity-100">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clear All</Text>
              </TouchableOpacity>
            </View>
            {history
              .slice()
              .reverse()
              .map((item, idx) => {
                const timeString =
                  new Date(item.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) +
                  " " +
                  new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <View
                    key={item.id || idx}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-row items-center justify-between shadow-md"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-slate-200 font-bold text-xs">{item.carrier || "WiFi Link"}</Text>
                      <Text className="text-slate-500 text-[10px] font-semibold mt-0.5">
                        {item.networkType} • {timeString}
                      </Text>
                    </View>

                    <View className="flex-row gap-4 items-center">
                      <View className="items-end">
                        <View className="flex-row items-center gap-1">
                          <ArrowDown size={11} color="#0ea5e9" />
                          <Text className="text-slate-200 font-black text-xs font-mono">
                            {item.download?.toFixed(1)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <ArrowUp size={11} color="#818cf8" />
                          <Text className="text-slate-400 font-semibold text-[10px] font-mono">
                            {item.upload?.toFixed(1)}
                          </Text>
                        </View>
                      </View>

                      {item.ping != null && (
                        <View className="border-l border-slate-800/80 pl-3 items-center justify-center min-w-[40px]">
                          <Text className="text-teal-400 font-black text-xs font-mono">{Math.round(item.ping)}</Text>
                          <Text className="text-slate-500 text-[7px] uppercase font-bold tracking-wider">Ping</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
