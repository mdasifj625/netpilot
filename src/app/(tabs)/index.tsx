/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  Animated,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import * as Device from "expo-device";
import {
  Shield,
  Radio,
  Wifi,
  Gauge,
  AlertTriangle,
  RefreshCw,
  Network,
  Sliders,
  Activity,
} from "lucide-react-native";
import Svg, { Polyline } from "react-native-svg";

// Import custom native modules
import {
  getCellularDetails,
  getNetworkDetails,
  CellularDiagnosticsData,
  NetworkDetailsData,
} from "../../../modules/cellular-diagnostics";
import { getConnectedWifiInfo, ConnectedWifiInfo } from "../../../modules/wifi-analyzer";
import { launchRadioInfo, launchMobileNetworkSettings } from "../../../modules/network-intent";
import { useAppStore } from "../../store/useAppStore";
import { resolveMacVendor } from "../../utils/macVendors";

export default function DashboardScreen() {
  const { settings } = useAppStore();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [cellDetails, setCellDetails] = useState<CellularDiagnosticsData | null>(null);
  const [netDetails, setNetDetails] = useState<NetworkDetailsData | null>(null);
  const [wifiDetails, setWifiDetails] = useState<ConnectedWifiInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingHistory, setPingHistory] = useState<number[]>([]);

  const fadeAnims = React.useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
  const slideAnims = React.useRef(Array.from({ length: 6 }, () => new Animated.Value(20))).current;

  React.useEffect(() => {
    const anims = fadeAnims.map((fade, idx) => {
      return Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[idx], {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.stagger(80, anims).start();
  }, []);

  // Check and request location permission (required for telephony scan results)
  const checkPermission = async () => {
    try {
      const response = await Location.getForegroundPermissionsAsync();
      const isFine = response.status === "granted" && response.android?.accuracy === "fine";
      setPermissionGranted(isFine);
      return isFine;
    } catch {
      setPermissionGranted(false);
      return false;
    }
  };

  const requestPermission = async () => {
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      const isFine = response.status === "granted" && response.android?.accuracy === "fine";
      setPermissionGranted(isFine);
      if (isFine) {
        updateTelemetry();
      } else {
        if (response.status === "granted") {
          Alert.alert(
            "Precise Location Required",
            "You enabled 'Approximate Location'. To read active bands and cellular towers, NetPilot needs 'Precise Location'.\n\nPlease enable it in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert(
            "Permission Required",
            "Location permission is required to read network hardware states and signal strengths."
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateTelemetry = () => {
    setIsRefreshing(true);
    try {
      // Query native modules
      const cell = getCellularDetails();
      const net = getNetworkDetails();
      const wifi = getConnectedWifiInfo();

      setCellDetails(cell);
      setNetDetails(net);
      setWifiDetails(wifi);
    } catch (error) {
      console.error("Failed to retrieve native telemetry:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Run telemetry update loop every 2 seconds when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const init = async () => {
        const isFine = await checkPermission();
        if (!isFine) {
          const response = await Location.getForegroundPermissionsAsync();
          if (response.status === "undetermined" || (response.status === "denied" && response.canAskAgain)) {
            await requestPermission();
          }
        }
      };

      init();
      updateTelemetry();

      const interval = setInterval(() => {
        updateTelemetry();
      }, 2000);

      return () => clearInterval(interval);
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      const interval = setInterval(async () => {
        const target = settings.customPingTarget.trim() !== "" ? settings.customPingTarget.trim() : "https://1.1.1.1";

        const start = Date.now();
        try {
          await fetch(target, { method: "HEAD", mode: "no-cors" });
          if (active) {
            const ms = Date.now() - start;
            setPingLatency(ms);
            setPingHistory((prev) => {
              const next = [...prev, ms];
              if (next.length > 15) next.shift();
              return next;
            });
          }
        } catch {
          if (active) setPingLatency(null);
        }
      }, 4000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [settings.customPingTarget])
  );

  // Determine signal quality styles
  const getSignalQuality = (rsrp: number | null) => {
    if (rsrp === null || rsrp === 0)
      return { label: "No Signal", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (rsrp >= -80)
      return {
        label: "Excellent",
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
      };
    if (rsrp >= -90)
      return { label: "Good", color: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/30" };
    if (rsrp >= -100)
      return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" };
    return { label: "Poor", color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/30" };
  };

  // Determine WiFi signal quality based on RSSI
  const getWifiSignalQuality = (level: number | null) => {
    if (level === null)
      return { label: "No Signal", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (level >= -55)
      return {
        label: "Excellent",
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
      };
    if (level >= -70)
      return { label: "Good", color: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/30" };
    if (level >= -85)
      return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" };
    return { label: "Poor", color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/30" };
  };

  // Compute overall network rating
  const getOverallHealth = () => {
    const rsrp = cellDetails?.rsrp ?? null;
    const latency = pingLatency;

    if (rsrp === null && latency === null) {
      return {
        label: "Gathering Telemetry...",
        desc: "Monitoring active wireless bands and ping responses.",
        color: "text-slate-400",
        border: "border-slate-800",
        bg: "bg-slate-900/50",
        glow: "bg-slate-500/10",
        icon: "info",
      };
    }

    if (latency !== null && latency < 35 && (rsrp === null || rsrp >= -85)) {
      return {
        label: "Gaming & Streaming Ready",
        desc: `Buttery smooth latency (${latency} ms) and excellent signal bandwidth. Ideal for competitive play and 4K media.`,
        color: "text-emerald-400",
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/10",
        glow: "bg-emerald-500/20",
        icon: "gaming",
      };
    }

    if (latency !== null && latency < 75 && (rsrp === null || rsrp >= -95)) {
      return {
        label: "HD Streaming Stable",
        desc: `Stable connectivity (${latency} ms) with reliable signal level. Great for HD video calls and cloud uploads.`,
        color: "text-sky-400",
        border: "border-sky-500/30",
        bg: "bg-sky-500/10",
        glow: "bg-sky-500/20",
        icon: "streaming",
      };
    }

    if (latency !== null && latency < 150) {
      return {
        label: "Standard Web Browsing",
        desc: `Moderate latency (${latency} ms). Suitable for standard browsing, social media, and messaging.`,
        color: "text-amber-400",
        border: "border-amber-500/30",
        bg: "bg-amber-500/10",
        glow: "bg-amber-500/20",
        icon: "basic",
      };
    }

    return {
      label: "Constrained Bandwidth / Jitter",
      desc:
        latency !== null
          ? `High response delay (${latency} ms) or poor signal. Buffer warnings likely during calls or streaming.`
          : "Severe packet loss or cellular attenuation. Check your network configuration.",
      color: "text-rose-400",
      border: "border-rose-500/30",
      bg: "bg-rose-500/10",
      glow: "bg-rose-500/20",
      icon: "alert",
    };
  };

  const signalQuality = getSignalQuality(cellDetails?.rsrp ?? null);
  const wifiSignalQuality = getWifiSignalQuality(wifiDetails?.level ?? null);
  const overallHealth = getOverallHealth();

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#020617" }} className="flex-1 bg-slate-950">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        className="flex-1 px-4 py-2"
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
        {/* Header */}
        <View className="flex-row justify-between items-center mb-5 mt-4">
          <View>
            <Text className="text-2xl font-bold text-slate-50">NetPilot</Text>
            <Text className="text-slate-400 text-xs mt-0.5">Real-time network telemetry</Text>
          </View>
          <TouchableOpacity
            onPress={updateTelemetry}
            className="p-2.5 rounded-full bg-slate-900 border border-slate-800 active:bg-slate-800"
          >
            <RefreshCw size={16} color="#94a3b8" className={isRefreshing ? "animate-spin" : ""} />
          </TouchableOpacity>
        </View>

        {/* Premium Location Explainer Card */}
        {permissionGranted === false && (
          <Animated.View
            style={{ transform: [{ translateY: slideAnims[0] }], opacity: fadeAnims[0], gap: 12 }}
            className="bg-slate-900 border border-amber-500/35 rounded-3xl p-5 mb-5 shadow-lg"
          >
            <View className="flex-row items-center gap-2.5">
              <AlertTriangle size={20} color="#f59e0b" />
              <Text className="text-sm font-bold text-amber-200">Why does NetPilot need Location?</Text>
            </View>
            <Text className="text-slate-400 text-xs leading-relaxed">
              Android security policies map wireless network access points (Wi-Fi SSIDs/MACs) and cell tower identifiers
              (PCIs/CIDs) directly to physical locations.
              {"\n\n"}
              To protect privacy, Google restricts apps from querying signal strengths or searching local network bands
              unless you actively authorize Location access. NetPilot performs all sweeps 100% locally on your device;
              your data is never sent to any cloud server.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              className="bg-amber-500 py-2.5 rounded-xl items-center justify-center active:bg-amber-600 mt-2"
            >
              <Text className="text-slate-950 font-black text-xs uppercase tracking-wider">Enable Location Access</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Connection Status Health Rating Banner */}
        <Animated.View
          style={{ transform: [{ translateY: slideAnims[0] }], opacity: fadeAnims[0] }}
          className={`bg-slate-900 border ${overallHealth.border} rounded-3xl p-4 mb-5 shadow-lg relative overflow-hidden flex-row items-center gap-3.5`}
        >
          <View
            className={`absolute -right-6 -top-6 w-16 h-16 rounded-full filter blur-xl opacity-25 ${
              overallHealth.icon === "gaming"
                ? "bg-emerald-500"
                : overallHealth.icon === "streaming"
                  ? "bg-sky-500"
                  : overallHealth.icon === "basic"
                    ? "bg-amber-500"
                    : "bg-rose-500"
            }`}
          />
          <View className={`p-2.5 rounded-2xl bg-slate-950 border border-slate-800`}>
            <Activity
              size={20}
              color={
                overallHealth.icon === "gaming"
                  ? "#10b981"
                  : overallHealth.icon === "streaming"
                    ? "#0ea5e9"
                    : overallHealth.icon === "basic"
                      ? "#f59e0b"
                      : "#ef4444"
              }
            />
          </View>
          <View className="flex-1 pr-2">
            <Text className={`text-xs font-black uppercase tracking-widest ${overallHealth.color}`}>
              {overallHealth.label}
            </Text>
            <Text className="text-slate-400 text-[10px] font-semibold mt-1 leading-4">{overallHealth.desc}</Text>
          </View>
        </Animated.View>

        {/* Context-Aware Primary Card (WiFi vs Cellular) */}
        {wifiDetails?.ssid != null ? (
          <Animated.View
            style={{ transform: [{ translateY: slideAnims[1] }], opacity: fadeAnims[1] }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden"
          >
            <View
              className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-20 ${wifiDetails.level && wifiDetails.level >= -70 ? "bg-emerald-500" : "bg-amber-500"}`}
            />

            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2">
                <Wifi size={20} color="#0ea5e9" />
                <Text className="text-lg font-bold text-slate-100">Wi-Fi Link</Text>
              </View>
              <View className={`${wifiSignalQuality.bg} ${wifiSignalQuality.border} border px-3 py-1 rounded-full`}>
                <Text className={`text-xs font-bold ${wifiSignalQuality.color}`}>{wifiSignalQuality.label}</Text>
              </View>
            </View>

            <View className="flex-row items-baseline mb-4">
              <Text className="text-5xl font-black text-slate-50">{wifiDetails.level ?? "—"}</Text>
              {wifiDetails.level !== null && (
                <Text className="text-slate-400 font-semibold text-sm ml-1.5">dBm (RSSI)</Text>
              )}
            </View>

            <View className="grid grid-cols-2 gap-4 flex-row flex-wrap border-t border-slate-800/80 pt-4">
              <View className="w-[47%]">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">SSID</Text>
                <Text className="text-slate-200 font-bold text-sm mt-0.5" numberOfLines={1}>
                  {wifiDetails.ssid}
                </Text>
              </View>
              <View className="w-[47%]">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Link Speed</Text>
                <Text className="text-slate-200 font-bold text-sm mt-0.5">
                  {wifiDetails.linkSpeed ? `${wifiDetails.linkSpeed} Mbps` : "—"}
                </Text>
              </View>
              <View className="w-[47%]">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Frequency</Text>
                <Text className="text-slate-200 font-bold text-sm mt-0.5">
                  {wifiDetails.frequency ? `${wifiDetails.frequency} MHz` : "—"}
                </Text>
              </View>
              <View className="w-[47%]">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Manufacturer</Text>
                <Text className="text-slate-200 font-bold text-sm mt-0.5" numberOfLines={1}>
                  {wifiDetails.bssid ? resolveMacVendor(wifiDetails.bssid) || "Unknown" : "—"}
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            style={{ transform: [{ translateY: slideAnims[1] }], opacity: fadeAnims[1] }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden"
          >
            <View
              className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-20 ${cellDetails?.rsrp ? (cellDetails.rsrp >= -90 ? "bg-emerald-500" : "bg-amber-500") : "bg-slate-500"}`}
            />

            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2">
                <Radio size={20} color="#0ea5e9" />
                <Text className="text-lg font-bold text-slate-100">Cellular Link</Text>
              </View>
              <View className={`${signalQuality.bg} ${signalQuality.border} border px-3 py-1 rounded-full`}>
                <Text className={`text-xs font-bold ${signalQuality.color}`}>{signalQuality.label}</Text>
              </View>
            </View>

            <View className="flex-row items-baseline mb-4">
              <Text className="text-5xl font-black text-slate-50">{cellDetails?.rsrp ?? "—"}</Text>
              {cellDetails?.rsrp && <Text className="text-slate-400 font-semibold text-sm ml-1.5">dBm (RSRP)</Text>}
            </View>

            <View className="grid grid-cols-2 gap-4 flex-row flex-wrap border-t border-slate-800/80 pt-4">
              <View className="w-[47%]">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Carrier</Text>
                <Text className="text-slate-200 font-bold text-sm mt-0.5">{cellDetails?.carrier || "No SIM"}</Text>
              </View>
              <View className="w-[47%]">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Network Type</Text>
                <Text className="text-slate-200 font-bold text-sm mt-0.5">{cellDetails?.networkType || "None"}</Text>
              </View>
              <View className="w-[47%]">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Active Band</Text>
                <Text className="text-slate-200 font-bold text-sm mt-0.5">
                  {cellDetails?.band ? `Band ${cellDetails.band}` : "—"}
                </Text>
              </View>
              <View className="w-[47%]">
                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">SINR</Text>
                <Text className="text-slate-200 font-bold text-sm mt-0.5">
                  {cellDetails?.sinr != null && cellDetails.sinr !== 2147483647 ? `${cellDetails.sinr} dB` : "—"}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* IP and Connection Diagnostics Card */}
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
            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Local IP</Text>
              <Text className="text-slate-200 font-mono text-sm">{netDetails?.ipAddress || "—"}</Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Gateway</Text>
              <Text className="text-slate-200 font-mono text-sm">{netDetails?.gateway || "—"}</Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">DNS Servers</Text>
              <Text
                className="text-slate-200 font-mono text-sm text-right max-w-[200px]"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {netDetails?.dns || "—"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
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

        {/* Device Diagnostics Hardware Details Card */}
        <Animated.View
          style={{ transform: [{ translateY: slideAnims[3] }], opacity: fadeAnims[3] }}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg"
        >
          <View className="flex-row items-center gap-2 mb-4">
            <Sliders size={20} color="#a78bfa" />
            <Text className="text-lg font-bold text-slate-100">System Hardware</Text>
          </View>
          <View style={{ gap: 14 }}>
            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Device Model</Text>
              <Text className="text-slate-200 font-bold text-sm">{Device.modelName || "Android Device"}</Text>
            </View>
            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Operating System</Text>
              <Text className="text-slate-200 font-bold text-sm">
                {Device.osName || "Android"} {Device.osVersion || ""}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-slate-400 text-sm">Architecture</Text>
              <Text className="text-slate-200 font-mono text-xs">
                {Platform.OS === "android" ? "ARM64-v8a" : "x86_64"}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Network Force / Settings Toggles */}
        <Animated.View style={{ transform: [{ translateY: slideAnims[5] }], opacity: fadeAnims[5] }}>
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Native Control Panels
          </Text>

          <View className="flex-row gap-4 mb-6">
            <TouchableOpacity
              onPress={() => {
                const success = launchMobileNetworkSettings();
                if (!success) Alert.alert("Error", "Could not open mobile settings.");
              }}
              className="flex-1 bg-slate-900 border border-slate-800 active:bg-slate-800 rounded-2xl p-4 items-center justify-center shadow-md"
            >
              <Sliders size={20} color="#0ea5e9" />
              <Text className="text-xs font-bold text-slate-300 mt-2 text-center">Mobile Net</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const success = launchRadioInfo();
                if (!success) {
                  Alert.alert(
                    "Force Band Blocked",
                    "Direct access to hidden network configuration is restricted on this device.\n\nManual settings path:\nSettings → Mobile Network → SIMs → Preferred Network Type",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Open Mobile Settings", onPress: () => launchMobileNetworkSettings() },
                    ]
                  );
                }
              }}
              className="flex-1 bg-slate-900 border border-slate-800 active:bg-slate-800 rounded-2xl p-4 items-center justify-center shadow-md"
            >
              <Gauge size={20} color="#818cf8" />
              <Text className="text-xs font-bold text-slate-300 mt-2 text-center">Force Band</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
