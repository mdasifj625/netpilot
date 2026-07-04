/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Platform, Alert, Linking, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { Radio, Activity, Layers, Cpu, AlertTriangle, Info } from "lucide-react-native";

import {
  getCellularDetails,
  CellularDiagnosticsData,
  getNetworkDetails,
  NetworkDetailsData,
} from "../../../modules/cellular-diagnostics";
import { launchRadioInfo } from "../../../modules/network-intent";
import { useAppStore } from "../../store/useAppStore";
import { CartesianChart as CartesianChartOriginal, Line as LineOriginal } from "victory-native";
const CartesianChart = CartesianChartOriginal as any;
const Line = LineOriginal as any;

export default function CellularScreen() {
  const router = useRouter();
  const { settings } = useAppStore();
  const [details, setDetails] = useState<CellularDiagnosticsData | null>(null);
  const [networkDetails, setNetworkDetails] = useState<NetworkDetailsData | null>(null);
  const [chartData, setChartData] = useState<{ index: number; rsrp: number }[]>([]);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  // Pulse animation for the background tracking indicator
  const trackingPulse = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (settings.backgroundTrackingEnabled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(trackingPulse, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(trackingPulse, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      trackingPulse.setValue(1.0);
    }
  }, [settings.backgroundTrackingEnabled]);

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
    try {
      const data = getCellularDetails();
      setDetails(data);

      const netData = getNetworkDetails();
      setNetworkDetails(netData);

      if (data && data.rsrp !== null && data.rsrp !== 0 && data.rsrp !== 2147483647) {
        // Clamp RSRP to a reasonable display range (-140 to -40)
        const rsrpClamped = Math.max(-140, Math.min(-40, data.rsrp));

        setChartData((prev) => {
          const next = [...prev, { index: prev.length, rsrp: rsrpClamped }];
          if (next.length > 20) {
            next.shift();
            // Re-index from 0 to 19 to keep chart coordinate consistent
            return next.map((d, i) => ({ index: i, rsrp: d.rsrp }));
          }
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to query cellular diagnostics:", e);
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

  // Helper to split LTE CID into eNodeB and Sector ID
  const getLteIdentifiers = (cid: number | null) => {
    if (!cid || cid === 2147483647) return { enodeb: "—", sector: "—" };
    // eNodeB is 20 bits (CID / 256), Sector is 8 bits (CID % 256)
    const enodeb = Math.floor(cid / 256);
    const sector = cid % 256;
    return { enodeb: enodeb.toString(), sector: sector.toString() };
  };

  const getBandDescription = (band: number | null, networkType: string) => {
    if (!band || band === 2147483647) return "—";
    const netUpper = networkType.toUpperCase();
    const is5G = netUpper.includes("5G") || netUpper.includes("NR");
    if (is5G) {
      switch (band) {
        case 78:
          return "n78 (3500 MHz C-Band)";
        case 77:
          return "n77 (3700 MHz C-Band)";
        case 41:
          return "n41 (2500 MHz Mid-Band)";
        case 28:
          return "n28 (700 MHz Low-Band)";
        case 5:
          return "n5 (850 MHz Low-Band)";
        default:
          return `n${band}`;
      }
    } else {
      switch (band) {
        case 1:
          return "B1 (2100 MHz)";
        case 2:
          return "B2 (1900 MHz)";
        case 3:
          return "B3 (1800 MHz)";
        case 4:
          return "B4 (1700/2100 MHz AWS)";
        case 5:
          return "B5 (850 MHz)";
        case 7:
          return "B7 (2600 MHz)";
        case 8:
          return "B8 (900 MHz)";
        case 12:
          return "B12 (700 MHz)";
        case 13:
          return "B13 (700 MHz)";
        case 14:
          return "B14 (700 MHz FirstNet)";
        case 17:
          return "B17 (700 MHz)";
        case 20:
          return "B20 (800 MHz)";
        case 28:
          return "B28 (700 MHz)";
        case 38:
          return "B38 (2600 MHz TDD)";
        case 40:
          return "B40 (2300 MHz TDD)";
        case 41:
          return "B41 (2500 MHz TDD)";
        default:
          return `B${band}`;
      }
    }
  };

  const { enodeb, sector } = getLteIdentifiers(details?.cid ?? null);

  // Signal range helpers
  const signalValue = details?.rsrp ?? null;
  const isNoSignal = !signalValue || signalValue === 0 || signalValue === 2147483647;

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#020617" }} className="flex-1 bg-slate-950">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        className="flex-1 px-4 py-2"
      >
        {/* Title & Background service indicator badge */}
        <View className="mb-6 mt-4 flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-50">Cellular Diagnostics</Text>
            <Text className="text-slate-400 text-xs mt-0.5">Physical network layer and signal monitoring</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/settings")}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              settings.backgroundTrackingEnabled
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-slate-900 border-slate-800"
            }`}
          >
            <Animated.View
              style={{ opacity: trackingPulse }}
              className={`w-2 h-2 rounded-full ${settings.backgroundTrackingEnabled ? "bg-emerald-400" : "bg-slate-500"}`}
            />
            <Text
              className={`text-[10px] font-black uppercase tracking-wider ${settings.backgroundTrackingEnabled ? "text-emerald-400" : "text-slate-400"}`}
            >
              {settings.backgroundTrackingEnabled ? "Tracking On" : "Tracking Off"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Precise Location Explainer Card */}
        {permissionGranted === false && (
          <View className="bg-slate-900 border border-amber-500/35 rounded-3xl p-5 mb-5 shadow-lg" style={{ gap: 12 }}>
            <View className="flex-row items-center gap-2.5">
              <AlertTriangle size={20} color="#f59e0b" />
              <Text className="text-sm font-bold text-amber-200">Precise Location Required</Text>
            </View>
            <Text className="text-slate-400 text-xs leading-relaxed">
              Android restricts apps from reading active bands or cell towers without Precise Location access. Your data
              remains 100% local.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              className="bg-amber-500 py-2.5 rounded-xl items-center justify-center active:bg-amber-600 mt-2"
            >
              <Text className="text-slate-950 font-black text-xs uppercase tracking-wider">
                Enable Location Settings
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Real-time Graph */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Activity size={18} color="#0ea5e9" />
              <Text className="text-sm font-bold text-slate-200">Real-time Signal (dBm)</Text>
            </View>
            <Text className="text-[10px] text-slate-400 font-medium">20 Samples (2s interval)</Text>
          </View>

          <View className="h-44 w-full bg-slate-950/40 rounded-2xl border border-slate-800/50 justify-center overflow-hidden p-2">
            {Platform.OS === "web" ? (
              <View className="items-center justify-center h-full">
                <Text className="text-xs text-sky-400 font-semibold uppercase tracking-wider mb-2">
                  Signal History (Web Mode)
                </Text>
                <View className="flex-row items-end gap-1 h-16 px-4">
                  {[30, 45, 60, 40, 50, 75, 80, 65, 55, 70, 75, 60, 50, 65, 80, 85, 75, 90, 85, 95].map((val, idx) => (
                    <View key={idx} style={{ height: `${val}%` }} className="w-1.5 bg-sky-500/60 rounded-t-sm" />
                  ))}
                </View>
                <Text className="text-3xs text-slate-500 font-medium mt-2">
                  Victory CartesianChart (Skia) is active on Android
                </Text>
              </View>
            ) : CartesianChart && chartData.length > 1 ? (
              <CartesianChart data={chartData} xKey="index" yKeys={["rsrp"]} domain={{ y: [-130, -50] }}>
                {({ points }: any) => <Line points={points.rsrp} color="#0ea5e9" strokeWidth={3} curve="cardinal" />}
              </CartesianChart>
            ) : (
              <View className="items-center justify-center h-full">
                <Text className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  Collecting Signal Samples...
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Advanced Metrics Grid */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row items-center gap-2 mb-4">
            <Radio size={18} color="#0ea5e9" />
            <Text className="text-sm font-bold text-slate-200">Signal Diagnostics</Text>
          </View>

          <View style={{ gap: 14 }}>
            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">RSRP (Reference Signal Power)</Text>
              <Text className="text-slate-100 font-semibold text-sm">{isNoSignal ? "—" : `${details?.rsrp} dBm`}</Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">RSRQ (Reference Signal Quality)</Text>
              <Text className="text-slate-100 font-semibold text-sm">
                {details?.rsrq != null && details.rsrq !== 2147483647 ? `${details.rsrq} dB` : "—"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">SINR (Signal-to-Noise Ratio)</Text>
              <Text className="text-slate-100 font-semibold text-sm">
                {details?.sinr != null && details.sinr !== 2147483647 ? `${details.sinr} dB` : "—"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">RSSI (Signal Strength)</Text>
              <Text className="text-slate-100 font-semibold text-sm">
                {details?.rssi != null && details.rssi !== 2147483647 ? `${details.rssi} dBm` : "—"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-slate-400 text-sm">Carrier Band</Text>
              <Text className="text-slate-100 font-semibold text-sm">
                {getBandDescription(details?.band ?? null, details?.networkType ?? "")}
              </Text>
            </View>
          </View>
        </View>

        {/* Network Identifiers Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row items-center gap-2 mb-4">
            <Layers size={18} color="#818cf8" />
            <Text className="text-sm font-bold text-slate-200">Cell Tower Identifiers</Text>
          </View>

          <View style={{ gap: 14 }}>
            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">eNodeB ID (Base Station)</Text>
              <Text className="text-slate-100 font-mono text-sm">{enodeb}</Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Sector ID</Text>
              <Text className="text-slate-100 font-mono text-sm">{sector}</Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Physical Cell ID (PCI)</Text>
              <Text className="text-slate-100 font-mono text-sm">
                {details?.pci != null && details.pci !== 2147483647 ? details.pci : "—"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Tracking Area Code (TAC)</Text>
              <Text className="text-slate-100 font-mono text-sm">
                {details?.tac != null && details.tac !== 2147483647 ? details.tac : "—"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Global Cell Identity (CID)</Text>
              <Text className="text-slate-100 font-mono text-sm">
                {details?.cid != null && details.cid !== 2147483647 ? details.cid : "—"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-slate-400 text-sm">Cell Global Identifier (CGI)</Text>
              <Text
                className="text-slate-100 font-mono text-xs text-right max-w-[190px]"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {details?.cgi || "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Network IP Configuration Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row items-center gap-2 mb-4">
            <Radio size={18} color="#2dd4bf" />
            <Text className="text-sm font-bold text-slate-200">Network IP Configuration</Text>
          </View>

          <View style={{ gap: 14 }}>
            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">IP Address</Text>
              <Text className="text-slate-100 font-mono text-sm">{networkDetails?.ipAddress ?? "—"}</Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">Gateway Router</Text>
              <Text className="text-slate-100 font-mono text-sm">{networkDetails?.gateway ?? "—"}</Text>
            </View>

            <View className="flex-row justify-between items-center border-b border-slate-800/40 pb-2.5">
              <Text className="text-slate-400 text-sm">DNS Servers</Text>
              <Text className="text-slate-100 font-mono text-xs text-right max-w-[190px]">
                {networkDetails?.dns ?? "—"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-slate-400 text-sm">VPN Connection</Text>
              <View
                className={`px-2 py-0.5 rounded ${networkDetails?.vpnActive ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-slate-950 border border-slate-800"}`}
              >
                <Text
                  className={`text-[10px] font-black uppercase tracking-wider ${networkDetails?.vpnActive ? "text-emerald-400" : "text-slate-500"}`}
                >
                  {networkDetails?.vpnActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Advanced Radio Settings Button */}
        {Platform.OS === "android" && (
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden">
            <View className="flex-row items-center gap-2 mb-3">
              <Cpu size={18} color="#f59e0b" />
              <Text className="text-sm font-bold text-slate-200">Advanced Radio Information</Text>
            </View>
            <Text className="text-[10px] text-slate-400 leading-normal mb-4 font-semibold">
              Access the Android secret Radio info screen to lock network modes (e.g. 5G Only, LTE Only) or audit cell
              transmitter channels.
            </Text>
            <TouchableOpacity
              onPress={() => {
                try {
                  launchRadioInfo();
                } catch {
                  Alert.alert("Error", "Could not launch Android Radio settings screen.");
                }
              }}
              className="bg-slate-950 border border-slate-800 active:bg-slate-900 py-3 rounded-2xl items-center justify-center flex-row gap-2"
            >
              <Text className="text-sky-400 font-extrabold text-xs uppercase tracking-wider">
                Open System Radio Settings
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Informative Note */}
        <View className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-4 mb-6 flex-row gap-3 items-center">
          <Info size={20} color="#64748b" />
          <Text className="text-xs text-slate-500 flex-1 leading-relaxed">
            Signal metrics update every 2 seconds. The rolling graph renders relative changes in signal strength over
            the last 40 seconds. Values above -85 dBm indicate optimal speed and connectivity.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
