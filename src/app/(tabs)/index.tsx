 
import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  RefreshControl,
  Alert,
} from "react-native";

import * as Device from "expo-device";
import {
  Shield,
  Radio,
  Gauge,
  AlertTriangle,
  Network,
  Sliders,
  Cpu,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import Svg, { Polyline } from "react-native-svg";

import { launchRadioInfo, launchMobileNetworkSettings } from "../../../modules/network-intent";

import { useDashboardViewModel } from "../../features/dashboard/useDashboardViewModel";
import { WifiLinkCard } from "../../features/dashboard/components/WifiLinkCard";
import { CellularLinkCard } from "../../features/dashboard/components/CellularLinkCard";

export default function DashboardScreen() {
  const {
    settings,
    permissionGranted,
    cellDetails,
    netDetails,
    wifiDetails,
    isRefreshing,
    pingLatency,
    pingHistory,
    selectedSimIndex,
    setSelectedSimIndex,
    isSystemExpanded,
    setIsSystemExpanded,
    fadeAnims,
    slideAnims,
    updateTelemetry,
    requestPermission,
  } = useDashboardViewModel();

  const getOverallHealth = () => {
    const rsrp =
      cellDetails && cellDetails.length > 0 ? cellDetails[selectedSimIndex]?.rsrp || cellDetails[0].rsrp : null;
    const latency = pingLatency;
    const validRsrp = rsrp !== null && rsrp !== 0 && rsrp !== 2147483647 ? rsrp : null;

    if (validRsrp === null && latency === null)
      return {
        label: "Gathering Telemetry...",
        desc: "Monitoring wireless bands and ping responses.",
        color: "text-slate-400",
        border: "border-slate-800",
        bg: "bg-slate-900/50",
        glow: "bg-slate-500/10",
        icon: "info",
      };

    if ((latency === null || latency < 100) && (validRsrp === null || validRsrp >= -85)) {
      return {
        label: "Optimal / Ultra-Low Latency",
        desc:
          latency !== null
            ? `Smooth latency (${latency} ms) and excellent signal.`
            : "Excellent signal strength. Ping latency pending.",
        color: "text-emerald-400",
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/10",
        glow: "bg-emerald-500/20",
        icon: "gaming",
      };
    }

    if ((latency === null || latency < 200) && (validRsrp === null || validRsrp >= -100)) {
      return {
        label: "Stable / HD Streaming",
        desc:
          latency !== null
            ? `Stable connectivity (${latency} ms) with reliable signal.`
            : "Reliable signal strength. Ping latency pending.",
        color: "text-sky-400",
        border: "border-sky-500/30",
        bg: "bg-sky-500/10",
        glow: "bg-sky-500/20",
        icon: "streaming",
      };
    }

    if ((latency === null || latency < 350) && (validRsrp === null || validRsrp >= -115)) {
      return {
        label: "Fair / Standard Browsing",
        desc:
          latency !== null
            ? `Moderate latency (${latency} ms) or fair signal.`
            : "Fair signal strength. Suitable for standard browsing.",
        color: "text-amber-400",
        border: "border-amber-500/30",
        bg: "bg-amber-500/10",
        glow: "bg-amber-500/20",
        icon: "basic",
      };
    }

    return {
      label: "Poor Network Quality / High Delay",
      desc:
        latency !== null ? `High delay (${latency} ms) or weak signal.` : "Severe cellular attenuation or weak signal.",
      color: "text-rose-400",
      border: "border-rose-500/30",
      bg: "bg-rose-500/10",
      glow: "bg-rose-500/20",
      icon: "alert",
    };
  };


  const overallHealth = getOverallHealth();

  const getSubnetMask = (prefix: number | null) => {
    if (!prefix) return "—";
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return [mask >>> 24, (mask >> 16) & 255, (mask >> 8) & 255, mask & 255].join(".");
  };

  return (
    <View style={{ flex: 1 }} className="flex-1">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32 }}
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={updateTelemetry}
            tintColor="#0ea5e9"
            colors={["#0ea5e9"]}
            progressBackgroundColor="#0f172a"
          />
        }
      >
        {permissionGranted === false && (
          <Animated.View
            style={{ transform: [{ translateY: slideAnims[0] }], opacity: fadeAnims[0], gap: 12 }}
            className="bg-slate-900 border border-amber-500/35 rounded-3xl p-5 mb-5 shadow-lg"
          >
            <View className="flex-row items-center gap-2.5">
              <AlertTriangle size={20} color="#f59e0b" />
              <Text className="text-sm font-bold text-amber-200">Precise Location Required</Text>
            </View>
            <Text className="text-slate-400 text-xs leading-relaxed">
              Android security policies map wireless bands to location. To read active bands and cellular towers,
              NetPilot needs Precise Location. Your data stays 100% local.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              className="bg-amber-500 py-2.5 rounded-xl items-center justify-center active:bg-amber-600 mt-2"
            >
              <Text className="text-slate-950 font-black text-xs uppercase tracking-wider">Enable Location Access</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {wifiDetails?.ssid != null ? (
          <WifiLinkCard
            wifiDetails={wifiDetails}
            overallHealth={overallHealth}
            fadeAnim={fadeAnims[1]}
            slideAnim={slideAnims[1]}
          />
        ) : cellDetails && cellDetails.length > 0 ? (
          <CellularLinkCard
            cellDetails={cellDetails}
            selectedSimIndex={selectedSimIndex}
            setSelectedSimIndex={setSelectedSimIndex}
            overallHealth={overallHealth}
            fadeAnim={fadeAnims[1]}
            slideAnim={slideAnims[1]}
          />
        ) : (
          <Animated.View
            style={{ transform: [{ translateY: slideAnims[1] }], opacity: fadeAnims[1] }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden"
          >
            <View className="flex-row items-center gap-2 mb-4">
              <Radio size={20} color="#0ea5e9" />
              <Text className="text-lg font-bold text-slate-100">No Cellular Link</Text>
            </View>
            <Text className="text-slate-400">Insert SIM or enable cellular data.</Text>
          </Animated.View>
        )}

        {/* Native Control Panels */}
        <Animated.View style={{ transform: [{ translateY: slideAnims[5] }], opacity: fadeAnims[5] }} className="mb-5">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Native Control Panels
          </Text>
          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={() => {
                if (!launchMobileNetworkSettings()) Alert.alert("Error", "Could not open settings.");
              }}
              className="flex-1 bg-slate-900 border border-slate-800 active:bg-slate-800 rounded-2xl p-4 items-center justify-center shadow-md"
            >
              <Sliders size={20} color="#0ea5e9" />
              <Text className="text-[10px] font-bold text-slate-300 mt-2 text-center uppercase">Mobile Net</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (!launchRadioInfo())
                  Alert.alert("Blocked", "Path: Settings → Mobile Network → SIMs", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open Mobile Settings", onPress: () => launchMobileNetworkSettings() },
                  ]);
              }}
              className="flex-1 bg-slate-900 border border-slate-800 active:bg-slate-800 rounded-2xl p-4 items-center justify-center shadow-md"
            >
              <Gauge size={20} color="#818cf8" />
              <Text className="text-[10px] font-bold text-slate-300 mt-2 text-center uppercase">Force Band</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          style={{ transform: [{ translateY: slideAnims[2] }], opacity: fadeAnims[2] }}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg"
        >
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Network size={20} color="#818cf8" />
              <Text className="text-lg font-bold text-slate-100">IP Diagnostics</Text>
            </View>
            <View
              className={`px-3 py-1 rounded-full border ${netDetails?.ipAddress ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}
            >
              <Text className={`text-xs font-bold ${netDetails?.ipAddress ? "text-emerald-400" : "text-rose-400"}`}>
                {netDetails?.ipAddress ? "CONNECTED" : "DISCONNECTED"}
              </Text>
            </View>
          </View>
          <View style={{ gap: 14 }}>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">Local IPv4</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">
                {netDetails?.ipAddress || "—"}
              </Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">Subnet Mask</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">
                {getSubnetMask(netDetails?.subnetPrefix ?? null)}
                {netDetails?.subnetPrefix ? ` (/${netDetails.subnetPrefix})` : ""}
              </Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">IPv6 Address</Text>
              <Text className="text-slate-200 font-mono text-xs text-right flex-shrink-1">
                {netDetails?.ipv6Address || "—"}
              </Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">Gateway</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">
                {netDetails?.gateway || "—"}
              </Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">DNS Servers</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">
                {netDetails?.dns || "—"}
              </Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">Interface</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">
                {netDetails?.interfaceName || "—"}
              </Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <View className="flex-1">
                <Text className="text-slate-400 text-sm">Latency</Text>
                <Text className="text-[10px] text-slate-500 mt-0.5">
                  {settings.customPingTarget
                    ? settings.customPingTarget.replace("https://", "").replace("http://", "").split("/")[0]
                    : "1.1.1.1"}
                </Text>
              </View>
              <View className="flex-row items-center gap-3.5">
                {pingHistory.length >= 2 && (
                  <View className="bg-slate-950/40 border border-slate-800/45 px-1.5 py-1 rounded-xl">
                    <Svg width="80" height="20">
                      <Polyline
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={pingHistory
                          .map((val, idx) => {
                            const max = Math.max(...pingHistory, 60);
                            const min = Math.min(...pingHistory, 10);
                            const range = max - min || 1;
                            const x = (idx / (pingHistory.length - 1)) * 80;
                            const y = 20 - ((val - min) / range) * 16 - 2;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                    </Svg>
                  </View>
                )}
                <Text
                  className={`font-mono text-sm font-bold ${pingLatency !== null ? "text-sky-400" : "text-slate-400"}`}
                >
                  {pingLatency !== null ? `${pingLatency} ms` : "—"}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-slate-400 text-sm">VPN Tunnel</Text>
              <View className="flex-row items-center gap-1.5">
                <Shield size={14} color={netDetails?.vpnActive ? "#10b981" : "#64748b"} />
                <Text className={`font-bold text-sm ${netDetails?.vpnActive ? "text-emerald-400" : "text-slate-400"}`}>
                  {netDetails?.vpnActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Collapsible System Hardware & Native Controls */}
        <Animated.View
          style={{ transform: [{ translateY: slideAnims[4] }], opacity: fadeAnims[4] }}
          className="bg-slate-900/60 border border-slate-800/60 rounded-3xl mb-5 overflow-hidden"
        >
          <TouchableOpacity
            onPress={() => setIsSystemExpanded(!isSystemExpanded)}
            className="p-5 flex-row justify-between items-center bg-slate-900"
          >
            <View className="flex-row items-center gap-2">
              <Cpu size={18} color="#a78bfa" />
              <Text className="text-sm font-bold text-slate-200">System Hardware & Tools</Text>
            </View>
            {isSystemExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
          </TouchableOpacity>

          {isSystemExpanded && (
            <View className="p-5 pt-2 border-t border-slate-800/40" style={{ gap: 20 }}>
              <View style={{ gap: 14 }}>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Manufacturer</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">
                    {Device.manufacturer || "Unknown"}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Device Model</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">
                    {Device.modelName || "Unknown"}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Board / Design</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">
                    {Device.designName || "Unknown"}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Hardware Year</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">
                    {Device.deviceYearClass || "Unknown"}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Total RAM</Text>
                  <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">
                    {Device.totalMemory ? (Device.totalMemory / 1024 / 1024 / 1024).toFixed(1) + " GB" : "Unknown"}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">OS / Build</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">
                    {Device.osName || "Android"} {Device.osVersion || ""} ({Device.osBuildId || "Unknown"})
                  </Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Architecture</Text>
                  <Text className="text-slate-200 font-mono text-xs text-right flex-shrink-1">
                    {Platform.OS === "android" ? "ARM64-v8a" : "x86_64"}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start">
                  <Text className="text-slate-400 text-sm mr-4">Environment</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">
                    {Device.isDevice ? "Physical Device" : "Emulator"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
