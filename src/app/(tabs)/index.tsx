import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { 
  Shield, 
  Radio, 
  Wifi, 
  Gauge, 
  AlertTriangle, 
  Info, 
  Lock, 
  RefreshCw, 
  HelpCircle,
  Network,
  Sliders,
  MapPin,
  Maximize2
} from "lucide-react-native";

// Import custom native modules
import { getCellularDetails, getNetworkDetails, CellularDiagnosticsData, NetworkDetailsData } from "../../../modules/cellular-diagnostics";
import { launchRadioInfo, launchMobileNetworkSettings, launchSamsungBandSelection } from "../../../modules/network-intent";

export default function DashboardScreen() {
  const router = useRouter();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [cellDetails, setCellDetails] = useState<CellularDiagnosticsData | null>(null);
  const [netDetails, setNetDetails] = useState<NetworkDetailsData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check and request location permission (required for telephony scan results)
  const checkPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
      } else {
        setPermissionGranted(false);
      }
    } catch (e) {
      setPermissionGranted(false);
    }
  };

  const requestPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
        updateTelemetry();
      } else {
        setPermissionGranted(false);
        Alert.alert(
          "Permission Required",
          "Location permission is required to read network hardware states and signal strengths."
        );
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
      
      setCellDetails(cell);
      setNetDetails(net);
    } catch (error) {
      console.error("Failed to retrieve native telemetry:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Run telemetry update loop every 2 seconds when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      checkPermission();
      updateTelemetry();

      const interval = setInterval(() => {
        updateTelemetry();
      }, 2000);

      return () => clearInterval(interval);
    }, [])
  );

  // Determine signal quality styles
  const getSignalQuality = (rsrp: number | null) => {
    if (rsrp === null || rsrp === 0) return { label: "No Signal", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (rsrp >= -80) return { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
    if (rsrp >= -90) return { label: "Good", color: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/30" };
    if (rsrp >= -100) return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" };
    return { label: "Poor", color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/30" };
  };

  const signalQuality = getSignalQuality(cellDetails?.rsrp ?? null);

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-4 py-2">
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

        {/* Permission Banner */}
        {permissionGranted === false && (
          <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-5 flex-row gap-3 items-center">
            <AlertTriangle size={24} color="#f59e0b" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-amber-200">Location Access Needed</Text>
              <Text className="text-xs text-amber-400 mt-0.5">
                Android restricts network and carrier details without location permissions.
              </Text>
            </View>
            <TouchableOpacity 
              onPress={requestPermission} 
              className="bg-amber-500 px-3 py-1.5 rounded-lg active:bg-amber-600"
            >
              <Text className="text-xs font-bold text-slate-950">Grant</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Primary Telemetry Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden">
          {/* Signal Indicator background glow */}
          <View className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-20 ${cellDetails?.rsrp ? (cellDetails.rsrp >= -90 ? "bg-emerald-500" : "bg-amber-500") : "bg-slate-500"}`} />

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
            <Text className="text-5xl font-black text-slate-50">
              {cellDetails?.rsrp ?? "—"}
            </Text>
            {cellDetails?.rsrp && (
              <Text className="text-slate-400 font-semibold text-sm ml-1.5">dBm (RSRP)</Text>
            )}
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
        </View>

        {/* IP and Connection Diagnostics Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Network size={20} color="#818cf8" />
              <Text className="text-lg font-bold text-slate-100">IP Diagnostics</Text>
            </View>
            <View className={`px-3 py-1 rounded-full border ${netDetails?.ipAddress ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
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
              <Text className="text-slate-200 font-mono text-sm text-right max-w-[200px]" numberOfLines={1} ellipsizeMode="tail">
                {netDetails?.dns || "—"}
              </Text>
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
        </View>

        {/* Coverage Map Navigation Card */}
        <TouchableOpacity 
          onPress={() => router.push("/map")}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg flex-row justify-between items-center overflow-hidden relative"
        >
          {/* Subtle Map visual icon glow */}
          <View className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-sky-500/10 filter blur-xl" />
          <View className="flex-row items-center gap-3.5 flex-1 pr-4">
            <View className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/20">
              <MapPin size={24} color="#0ea5e9" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-slate-100">Coverage Tracker</Text>
              <Text className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                Visualize recorded cellular RSRP and download speeds on an interactive heatmap.
              </Text>
            </View>
          </View>
          <View className="p-2 rounded-full bg-slate-950 border border-slate-800">
            <Maximize2 size={16} color="#94a3b8" />
          </View>
        </TouchableOpacity>

        {/* Network Force / Settings Toggles */}
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">Native Control Panels</Text>
        
        <View className="flex-row gap-3 mb-6">
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
                  "Intent Blocked",
                  "Your device manufacturer has blocked direct access to the hidden RadioInfo interface (*#*#4636#*#*)."
                );
              }
            }}
            className="flex-1 bg-slate-900 border border-slate-800 active:bg-slate-800 rounded-2xl p-4 items-center justify-center shadow-md"
          >
            <Gauge size={20} color="#818cf8" />
            <Text className="text-xs font-bold text-slate-300 mt-2 text-center">Force Band</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => {
              const success = launchSamsungBandSelection();
              if (!success) {
                Alert.alert(
                  "Not Supported",
                  "Samsung band-lock menu is only available on Samsung Galaxy devices."
                );
              }
            }}
            className="flex-1 bg-slate-900 border border-slate-800 active:bg-slate-800 rounded-2xl p-4 items-center justify-center shadow-md"
          >
            <Lock size={20} color="#38bdf8" />
            <Text className="text-xs font-bold text-slate-300 mt-2 text-center">Samsung lock</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
