/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useCallback } from "react";
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

import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import * as Device from "expo-device";
import {
  Shield,
  Radio,
  Wifi,
  Gauge,
  AlertTriangle,
  Network,
  Sliders,
  Activity,
  Cpu,
  ChevronDown,
  ChevronUp,
  Zap,
  Globe,
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

export default function DashboardScreen() {
  const { settings } = useAppStore();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [cellDetails, setCellDetails] = useState<CellularDiagnosticsData[] | null>(null);
  const [netDetails, setNetDetails] = useState<NetworkDetailsData | null>(null);
  const [wifiDetails, setWifiDetails] = useState<ConnectedWifiInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [selectedSimIndex, setSelectedSimIndex] = useState(0);

  // Accordion states
  const [isSystemExpanded, setIsSystemExpanded] = useState(false);

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





  const fetchDiagnostics = useCallback(async () => {
    try {
      const perms = await Location.getForegroundPermissionsAsync();
      setPermissionGranted(perms.granted);

      if (perms.granted && Platform.OS !== "web") {
        setCellDetails(getCellularDetails());
        setNetDetails(getNetworkDetails());
        setWifiDetails(getConnectedWifiInfo());
      }

      // Hardware Telemetry
      // Only network telemetry remaining

    } catch (e) {
      console.log("Diag error:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDiagnostics();
    }, [fetchDiagnostics])
  );

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
            [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
          );
        } else {
          Alert.alert("Permission Required", "Location permission is required to read network hardware states and signal strengths.");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateTelemetry = () => {
    setIsRefreshing(true);
    try {
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

  const getSignalQuality = (rsrp: number | null) => {
    if (rsrp === null || rsrp === 0 || rsrp === 2147483647) return { label: "No Signal", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (rsrp >= -85) return { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
    if (rsrp >= -100) return { label: "Good", color: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/30" };
    if (rsrp >= -115) return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" };
    return { label: "Poor", color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/30" };
  };

  const getWifiSignalQuality = (level: number | null) => {
    if (level === null) return { label: "No Signal", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (level >= -55) return { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
    if (level >= -70) return { label: "Good", color: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/30" };
    if (level >= -85) return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" };
    return { label: "Poor", color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/30" };
  };

  const getOverallHealth = () => {
    const rsrp = cellDetails && cellDetails.length > 0 ? (cellDetails[selectedSimIndex]?.rsrp || cellDetails[0].rsrp) : null;
    const latency = pingLatency;
    const validRsrp = rsrp !== null && rsrp !== 0 && rsrp !== 2147483647 ? rsrp : null;

    if (validRsrp === null && latency === null) return { label: "Gathering Telemetry...", desc: "Monitoring wireless bands and ping responses.", color: "text-slate-400", border: "border-slate-800", bg: "bg-slate-900/50", glow: "bg-slate-500/10", icon: "info" };
    
    if ((latency === null || latency < 45) && (validRsrp === null || validRsrp >= -85)) {
        return { label: "Optimal / Ultra-Low Latency", desc: latency !== null ? `Smooth latency (${latency} ms) and excellent signal.` : "Excellent signal strength. Ping latency pending.", color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10", glow: "bg-emerald-500/20", icon: "gaming" };
    }
    
    if ((latency === null || latency < 90) && (validRsrp === null || validRsrp >= -100)) {
        return { label: "Stable / HD Streaming", desc: latency !== null ? `Stable connectivity (${latency} ms) with reliable signal.` : "Reliable signal strength. Ping latency pending.", color: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10", glow: "bg-sky-500/20", icon: "streaming" };
    }
    
    if ((latency === null || latency < 150) && (validRsrp === null || validRsrp >= -115)) {
        return { label: "Fair / Standard Browsing", desc: latency !== null ? `Moderate latency (${latency} ms) or fair signal.` : "Fair signal strength. Suitable for standard browsing.", color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10", glow: "bg-amber-500/20", icon: "basic" };
    }
    
    return { label: "Poor Network Quality / High Delay", desc: latency !== null ? `High delay (${latency} ms) or weak signal.` : "Severe cellular attenuation or weak signal.", color: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-500/10", glow: "bg-rose-500/20", icon: "alert" };
  };

  const getLteIdentifiers = (cid: number | null) => {
    if (!cid || cid === 2147483647) return { enodeb: "—", sector: "—" };
    return { enodeb: Math.floor(cid / 256).toString(), sector: (cid % 256).toString() };
  };

  const activeSim = cellDetails && cellDetails.length > 0 ? (cellDetails[selectedSimIndex] || cellDetails[0]) : null;
  const { enodeb, sector } = getLteIdentifiers(activeSim?.cid ?? null);
  const wifiSignalQuality = getWifiSignalQuality(wifiDetails?.level ?? null);
  const overallHealth = getOverallHealth();

  const getSubnetMask = (prefix: number | null) => {
    if (!prefix) return "—";
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return [(mask >>> 24), (mask >> 16 & 255), (mask >> 8 & 255), (mask & 255)].join(".");
  };

  return (
    <View style={{ flex: 1 }} className="flex-1">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32 }}
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={updateTelemetry} tintColor="#0ea5e9" colors={["#0ea5e9"]} progressBackgroundColor="#0f172a" />}
      >

        {permissionGranted === false && (
          <Animated.View style={{ transform: [{ translateY: slideAnims[0] }], opacity: fadeAnims[0], gap: 12 }} className="bg-slate-900 border border-amber-500/35 rounded-3xl p-5 mb-5 shadow-lg">
            <View className="flex-row items-center gap-2.5">
              <AlertTriangle size={20} color="#f59e0b" />
              <Text className="text-sm font-bold text-amber-200">Precise Location Required</Text>
            </View>
            <Text className="text-slate-400 text-xs leading-relaxed">
              Android security policies map wireless bands to location. To read active bands and cellular towers, NetPilot needs Precise Location. Your data stays 100% local.
            </Text>
            <TouchableOpacity onPress={requestPermission} className="bg-amber-500 py-2.5 rounded-xl items-center justify-center active:bg-amber-600 mt-2">
              <Text className="text-slate-950 font-black text-xs uppercase tracking-wider">Enable Location Access</Text>
            </TouchableOpacity>
          </Animated.View>
        )}



        {wifiDetails?.ssid != null ? (
          <Animated.View style={{ transform: [{ translateY: slideAnims[1] }], opacity: fadeAnims[1] }} className="bg-slate-900 border border-slate-800 rounded-3xl mb-5 shadow-lg relative overflow-hidden">
            <View className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-20 ${wifiDetails.level && wifiDetails.level >= -70 ? "bg-emerald-500" : "bg-amber-500"}`} />

            <View className="p-5">
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
                {wifiDetails.level !== null && <Text className="text-slate-400 font-semibold text-sm ml-1.5">dBm (RSSI)</Text>}
              </View>
              <View className="grid grid-cols-2 gap-4 flex-row flex-wrap border-t border-slate-800/80 pt-4">
                <View className="w-[47%]">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">SSID</Text>
                  <Text className="text-slate-200 font-bold text-sm mt-0.5" numberOfLines={1}>{wifiDetails.ssid}</Text>
                </View>
                <View className="w-[47%]">
                  <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Link Speed</Text>
                  <Text className="text-slate-200 font-bold text-sm mt-0.5">{wifiDetails.linkSpeed ? `${wifiDetails.linkSpeed} Mbps` : "—"}</Text>
                </View>
              </View>
            </View>

            {/* Merged Overall Health Banner */}
            <View className={`p-4 border-t border-slate-800/80 ${overallHealth.bg} flex-row items-center gap-3.5`}>
              <View className={`p-2 rounded-xl ${overallHealth.bg} border border-slate-800/50`}>
                {overallHealth.icon === "gaming" ? <Zap size={18} color="#10b981" /> :
                 overallHealth.icon === "streaming" ? <Activity size={18} color="#0ea5e9" /> :
                 overallHealth.icon === "basic" ? <Globe size={18} color="#f59e0b" /> :
                 overallHealth.icon === "alert" ? <AlertTriangle size={18} color="#ef4444" /> :
                 <Activity size={18} color="#94a3b8" />}
              </View>
              <View className="flex-1">
                <Text className={`text-[10px] font-black uppercase tracking-widest ${overallHealth.color}`}>{overallHealth.label}</Text>
                <Text className={`text-[10px] font-semibold mt-0.5 ${overallHealth.icon === "alert" ? "text-rose-300" : "text-slate-400"}`}>{overallHealth.desc}</Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          cellDetails && cellDetails.length > 0 ? (
            <View>
              {cellDetails.length > 1 && (
                <View className="flex-row gap-3 mb-4">
                  {cellDetails.map((sim, index) => {
                    const isSelected = selectedSimIndex === index;
                    return (
                      <TouchableOpacity
                        key={`sim-${index}`}
                        onPress={() => setSelectedSimIndex(index)}
                        className={`will-change-variable flex-1 py-3 rounded-2xl items-center border ${
                          isSelected
                            ? "bg-slate-800 border-sky-500/50 shadow-md"
                            : "bg-slate-900 border-slate-800/80"
                        }`}
                      >
                        <Text className={`text-xs font-black uppercase tracking-wider ${isSelected ? "text-sky-400" : "text-slate-500"}`}>
                          {sim.carrier || `SIM ${index + 1}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {(() => {
                const sim = cellDetails[selectedSimIndex] || cellDetails[0];
                const simSignal = getSignalQuality(sim.rsrp);
                const actualIndex = cellDetails[selectedSimIndex] ? selectedSimIndex : 0;
                return (
                  <Animated.View style={{ transform: [{ translateY: slideAnims[1] }], opacity: fadeAnims[1] }} className="bg-slate-900 border border-slate-800 rounded-3xl mb-5 shadow-lg relative overflow-hidden">
                    <View className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-20 ${sim.rsrp ? (sim.rsrp >= -90 ? "bg-emerald-500" : "bg-amber-500") : "bg-slate-500"}`} />

                    <View className="p-5">
                      <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                          <Radio size={20} color="#0ea5e9" />
                          <Text className="text-lg font-bold text-slate-100">
                            {sim.carrier ? `${sim.carrier} ${sim.networkType !== "Unknown" && sim.networkType ? sim.networkType : "Network"}` : `SIM ${actualIndex + 1} Network`}
                          </Text>
                        </View>
                        <View className={`${simSignal.bg} ${simSignal.border} border px-3 py-1 rounded-full`}>
                          <Text className={`text-xs font-bold ${simSignal.color}`}>{simSignal.label}</Text>
                        </View>
                      </View>

                      <View className="flex-row items-baseline mb-4">
                        <Text className="text-5xl font-black text-slate-50">{sim.rsrp ?? "—"}</Text>
                        {sim.rsrp !== null && <Text className="text-slate-400 font-semibold text-sm ml-1.5">dBm (RSRP)</Text>}
                      </View>

                      <View className="grid grid-cols-2 gap-4 flex-row flex-wrap border-t border-slate-800/80 pt-4">
                        <View className="w-[47%]">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Carrier</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.carrier || "Unknown"}</Text>
                        </View>
                        <View className="w-[47%]">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Network Type</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.networkType || "None"}</Text>
                        </View>
                        <View className="w-[47%]">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Active Band</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.band ? `Band ${sim.band}` : "—"}</Text>
                        </View>
                        <View className="w-[47%]">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">SINR</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.sinr != null && sim.sinr !== 2147483647 ? `${sim.sinr} dB` : "—"}</Text>
                        </View>
                        <View className="w-[47%] mt-2">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">RSRQ</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.rsrq != null && sim.rsrq !== 2147483647 ? `${sim.rsrq} dB` : "—"}</Text>
                        </View>
                        <View className="w-[47%] mt-2">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">RSSI</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.rssi != null && sim.rssi !== 2147483647 ? `${sim.rssi} dBm` : "—"}</Text>
                        </View>
                        <View className="w-[47%] mt-2">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">eNodeB ID</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{enodeb}</Text>
                        </View>
                        <View className="w-[47%] mt-2">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Sector</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sector}</Text>
                        </View>
                        <View className="w-[47%] mt-2">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">PCI</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.pci != null && sim.pci !== 2147483647 ? sim.pci : "—"}</Text>
                        </View>
                        <View className="w-[47%] mt-2">
                          <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">TAC</Text>
                          <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.tac != null && sim.tac !== 2147483647 ? sim.tac : "—"}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Merged Overall Health Banner */}
                    <View className={`p-4 border-t border-slate-800/80 ${overallHealth.bg} flex-row items-center gap-3.5`}>
                      <View className={`p-2 rounded-xl ${overallHealth.bg} border border-slate-800/50`}>
                        {overallHealth.icon === "gaming" ? <Zap size={18} color="#10b981" /> :
                         overallHealth.icon === "streaming" ? <Activity size={18} color="#0ea5e9" /> :
                         overallHealth.icon === "basic" ? <Globe size={18} color="#f59e0b" /> :
                         overallHealth.icon === "alert" ? <AlertTriangle size={18} color="#ef4444" /> :
                         <Activity size={18} color="#94a3b8" />}
                      </View>
                      <View className="flex-1">
                        <Text className={`text-[10px] font-black uppercase tracking-widest ${overallHealth.color}`}>{overallHealth.label}</Text>
                        <Text className={`text-[10px] font-semibold mt-0.5 ${overallHealth.icon === "alert" ? "text-rose-300" : "text-slate-400"}`}>{overallHealth.desc}</Text>
                      </View>
                    </View>
                  </Animated.View>
                );
              })()}
            </View>
          ) : (
            <Animated.View style={{ transform: [{ translateY: slideAnims[1] }], opacity: fadeAnims[1] }} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden">
              <View className="flex-row items-center gap-2 mb-4">
                <Radio size={20} color="#0ea5e9" />
                <Text className="text-lg font-bold text-slate-100">No Cellular Link</Text>
              </View>
              <Text className="text-slate-400">Insert SIM or enable cellular data.</Text>
            </Animated.View>
          )
        )}

        {/* Native Control Panels */}
        <Animated.View style={{ transform: [{ translateY: slideAnims[5] }], opacity: fadeAnims[5] }} className="mb-5">
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">Native Control Panels</Text>
          <View className="flex-row gap-4">
            <TouchableOpacity onPress={() => { if (!launchMobileNetworkSettings()) Alert.alert("Error", "Could not open settings."); }} className="flex-1 bg-slate-900 border border-slate-800 active:bg-slate-800 rounded-2xl p-4 items-center justify-center shadow-md">
              <Sliders size={20} color="#0ea5e9" />
              <Text className="text-[10px] font-bold text-slate-300 mt-2 text-center uppercase">Mobile Net</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { if (!launchRadioInfo()) Alert.alert("Blocked", "Path: Settings → Mobile Network → SIMs", [{ text: "Cancel", style: "cancel" }, { text: "Open Mobile Settings", onPress: () => launchMobileNetworkSettings() }]); }} className="flex-1 bg-slate-900 border border-slate-800 active:bg-slate-800 rounded-2xl p-4 items-center justify-center shadow-md">
              <Gauge size={20} color="#818cf8" />
              <Text className="text-[10px] font-bold text-slate-300 mt-2 text-center uppercase">Force Band</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: slideAnims[2] }], opacity: fadeAnims[2] }} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Network size={20} color="#818cf8" />
              <Text className="text-lg font-bold text-slate-100">IP Diagnostics</Text>
            </View>
            <View className={`px-3 py-1 rounded-full border ${netDetails?.ipAddress ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
              <Text className={`text-xs font-bold ${netDetails?.ipAddress ? "text-emerald-400" : "text-rose-400"}`}>{netDetails?.ipAddress ? "CONNECTED" : "DISCONNECTED"}</Text>
            </View>
          </View>
          <View style={{ gap: 14 }}>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">Local IPv4</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">{netDetails?.ipAddress || "—"}</Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">Subnet Mask</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">{getSubnetMask(netDetails?.subnetPrefix ?? null)}{netDetails?.subnetPrefix ? ` (/${netDetails.subnetPrefix})` : ""}</Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">IPv6 Address</Text>
              <Text className="text-slate-200 font-mono text-xs text-right flex-shrink-1">{netDetails?.ipv6Address || "—"}</Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">Gateway</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">{netDetails?.gateway || "—"}</Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">DNS Servers</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">{netDetails?.dns || "—"}</Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm mr-4">Interface</Text>
              <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">{netDetails?.interfaceName || "—"}</Text>
            </View>
            <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
              <View className="flex-1">
                <Text className="text-slate-400 text-sm">Latency</Text>
                <Text className="text-[10px] text-slate-500 mt-0.5">{settings.customPingTarget ? settings.customPingTarget.replace("https://", "").replace("http://", "").split("/")[0] : "1.1.1.1"}</Text>
              </View>
              <View className="flex-row items-center gap-3.5">
                {pingHistory.length >= 2 && (
                  <View className="bg-slate-950/40 border border-slate-800/45 px-1.5 py-1 rounded-xl">
                    <Svg width="80" height="20">
                      <Polyline fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pingHistory.map((val, idx) => { const max = Math.max(...pingHistory, 60); const min = Math.min(...pingHistory, 10); const range = max - min || 1; const x = (idx / (pingHistory.length - 1)) * 80; const y = 20 - ((val - min) / range) * 16 - 2; return `${x},${y}`; }).join(" ")} />
                    </Svg>
                  </View>
                )}
                <Text className={`font-mono text-sm font-bold ${pingLatency !== null ? "text-sky-400" : "text-slate-400"}`}>{pingLatency !== null ? `${pingLatency} ms` : "—"}</Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-slate-400 text-sm">VPN Tunnel</Text>
              <View className="flex-row items-center gap-1.5">
                <Shield size={14} color={netDetails?.vpnActive ? "#10b981" : "#64748b"} />
                <Text className={`font-bold text-sm ${netDetails?.vpnActive ? "text-emerald-400" : "text-slate-400"}`}>{netDetails?.vpnActive ? "Active" : "Inactive"}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Collapsible System Hardware & Native Controls */}
        <Animated.View style={{ transform: [{ translateY: slideAnims[4] }], opacity: fadeAnims[4] }} className="bg-slate-900/60 border border-slate-800/60 rounded-3xl mb-5 overflow-hidden">
          <TouchableOpacity onPress={() => setIsSystemExpanded(!isSystemExpanded)} className="p-5 flex-row justify-between items-center bg-slate-900">
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
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">{Device.manufacturer || "Unknown"}</Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Device Model</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">{Device.modelName || "Unknown"}</Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Board / Design</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">{Device.designName || "Unknown"}</Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Hardware Year</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">{Device.deviceYearClass || "Unknown"}</Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Total RAM</Text>
                  <Text className="text-slate-200 font-mono text-sm text-right flex-shrink-1">{Device.totalMemory ? (Device.totalMemory / 1024 / 1024 / 1024).toFixed(1) + " GB" : "Unknown"}</Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">OS / Build</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">{Device.osName || "Android"} {Device.osVersion || ""} ({Device.osBuildId || "Unknown"})</Text>
                </View>
                <View className="flex-row justify-between items-start border-b border-slate-800/40 pb-2.5">
                  <Text className="text-slate-400 text-sm mr-4">Architecture</Text>
                  <Text className="text-slate-200 font-mono text-xs text-right flex-shrink-1">{Platform.OS === "android" ? "ARM64-v8a" : "x86_64"}</Text>
                </View>
                <View className="flex-row justify-between items-start">
                  <Text className="text-slate-400 text-sm mr-4">Environment</Text>
                  <Text className="text-slate-200 font-bold text-sm text-right flex-shrink-1">{Device.isDevice ? "Physical Device" : "Emulator"}</Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
