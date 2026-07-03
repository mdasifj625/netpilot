import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { desc, isNotNull } from "drizzle-orm";
import { 
  ArrowLeft, 
  MapPin, 
  Layers, 
  Settings, 
  Radio, 
  Gauge, 
  Info,
  Maximize2
} from "lucide-react-native";
import * as Location from "expo-location";

// Import local database and schema
import { db } from "../database/db";
import { networkHistory, NetworkHistorySelect } from "../database/schema";

// Platform-conditional require for react-native-maps to prevent Web crash
let MapView: any = null;
let Marker: any = null;
let Heatmap: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== "web") {
  try {
    const maps = require("react-native-maps");
    MapView = maps.default;
    Marker = maps.Marker;
    Heatmap = maps.Heatmap;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.error("react-native-maps loading failed:", e);
  }
}

type MapMode = "signal" | "speed";
type VisualType = "heatmap" | "pins";

export default function CoverageMapScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<MapMode>("signal");
  const [visual, setVisual] = useState<VisualType>("heatmap");
  const [logs, setLogs] = useState<NetworkHistorySelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    fetchLogsAndLocation();
  }, []);

  const fetchLogsAndLocation = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch current GPS location for map centering
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
      }

      // 2. Fetch logged database records that have valid coordinates
      const history = await db
        .select()
        .from(networkHistory)
        .where(isNotNull(networkHistory.latitude))
        .orderBy(desc(networkHistory.timestamp))
        .limit(150);
      
      setLogs(history);

      // If we don't have current location but have logs, center on the latest log
      if (!currentCoords && history.length > 0 && history[0].latitude && history[0].longitude) {
        setCurrentCoords({
          latitude: history[0].latitude,
          longitude: history[0].longitude
        });
      }
    } catch (e) {
      console.error("Failed to compile map telemetry details:", e);
    } finally {
      setLoading(false);
    }
  };

  // Fallback default coordinates (Delhi/Mumbai/NY centroid placeholder)
  const defaultRegion = {
    latitude: currentCoords?.latitude ?? 40.7128,
    longitude: currentCoords?.longitude ?? -74.0060,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015
  };

  // Generate heatmap points
  const getHeatmapPoints = () => {
    return logs.map((log) => {
      let weight = 1;
      if (mode === "signal" && log.signal) {
        // Normalize RSRP: -140dBm to -40dBm scaled to 1 to 10 weight scale
        weight = Math.max(1, Math.min(10, Math.round((log.signal + 140) / 10)));
      } else if (mode === "speed" && log.download) {
        // Normalize Speed: 0Mbps to 100Mbps scaled to 1 to 10 weight scale
        weight = Math.max(1, Math.min(10, Math.round(log.download / 10)));
      }
      return {
        latitude: log.latitude!,
        longitude: log.longitude!,
        weight
      };
    });
  };

  // Helper to color code markers
  const getMarkerColor = (log: NetworkHistorySelect) => {
    if (mode === "signal") {
      const val = log.signal ?? -110;
      if (val >= -85) return "#10b981"; // Strong (Green)
      if (val >= -100) return "#f59e0b"; // Medium (Amber)
      return "#ef4444"; // Weak (Red)
    } else {
      const val = log.download ?? 0;
      if (val >= 40) return "#10b981"; // Fast (Green)
      if (val >= 15) return "#f59e0b"; // Medium (Amber)
      return "#ef4444"; // Slow (Red)
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      {/* Header bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-900 bg-slate-950/80">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft size={22} color="#f8fafc" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-slate-100">Coverage Tracking</Text>
        <TouchableOpacity onPress={fetchLogsAndLocation} className="p-1">
          <MapPin size={20} color="#0ea5e9" />
        </TouchableOpacity>
      </View>

      {/* Control Overlay Panels */}
      <View className="flex-row gap-2.5 px-4 py-2 bg-slate-900/60 border-b border-slate-900">
        {/* Toggle Mode */}
        <View className="flex-row bg-slate-950 border border-slate-800 rounded-lg p-0.5 flex-1">
          <TouchableOpacity 
            onPress={() => setMode("signal")}
            className={`flex-1 flex-row items-center justify-center py-1.5 rounded gap-1.5 ${mode === "signal" ? "bg-sky-500" : "bg-transparent"}`}
          >
            <Radio size={14} color={mode === "signal" ? "#ffffff" : "#94a3b8"} />
            <Text className={`font-bold text-3xs uppercase tracking-wider ${mode === "signal" ? "text-white" : "text-slate-400"}`}>Signal</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setMode("speed")}
            className={`flex-1 flex-row items-center justify-center py-1.5 rounded gap-1.5 ${mode === "speed" ? "bg-sky-500" : "bg-transparent"}`}
          >
            <Gauge size={14} color={mode === "speed" ? "#ffffff" : "#94a3b8"} />
            <Text className={`font-bold text-3xs uppercase tracking-wider ${mode === "speed" ? "text-white" : "text-slate-400"}`}>Speed</Text>
          </TouchableOpacity>
        </View>

        {/* Toggle Visual */}
        <View className="flex-row bg-slate-950 border border-slate-800 rounded-lg p-0.5 flex-1">
          <TouchableOpacity 
            onPress={() => setVisual("heatmap")}
            className={`flex-1 flex-row items-center justify-center py-1.5 rounded gap-1.5 ${visual === "heatmap" ? "bg-sky-500" : "bg-transparent"}`}
          >
            <Layers size={14} color={visual === "heatmap" ? "#ffffff" : "#94a3b8"} />
            <Text className={`font-bold text-3xs uppercase tracking-wider ${visual === "heatmap" ? "text-white" : "text-slate-400"}`}>Heatmap</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setVisual("pins")}
            className={`flex-1 flex-row items-center justify-center py-1.5 rounded gap-1.5 ${visual === "pins" ? "bg-sky-500" : "bg-transparent"}`}
          >
            <MapPin size={14} color={visual === "pins" ? "#ffffff" : "#94a3b8"} />
            <Text className={`font-bold text-3xs uppercase tracking-wider ${visual === "pins" ? "text-white" : "text-slate-400"}`}>Pins</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Map Viewer Canvas */}
      <View className="flex-1 bg-slate-900 justify-center items-center">
        {loading ? (
          <ActivityIndicator size="large" color="#0ea5e9" />
        ) : Platform.OS === "web" ? (
          /* Web Simulator View */
          <View className="w-full h-full flex-row">
            {/* Left simulated map grid */}
            <View className="flex-1 bg-slate-950 border-r border-slate-900 justify-center items-center p-6 relative overflow-hidden">
              <View className="absolute inset-0 opacity-5 border border-slate-700/20" style={{ borderStyle: "dashed" }} />
              {/* Fake grid lines */}
              <View className="absolute w-[200%] h-[200%] opacity-15 flex-wrap flex-row gap-8 justify-center items-center">
                {Array.from({ length: 48 }).map((_, i) => (
                  <View key={i} className="w-16 h-16 border border-slate-800 rounded" />
                ))}
              </View>
              
              {/* Simulated Heatmap Blurs / Pins */}
              {visual === "heatmap" ? (
                <View className="relative w-72 h-72 items-center justify-center">
                  <View className={`absolute w-44 h-44 rounded-full filter blur-3xl opacity-35 ${mode === "signal" ? "bg-emerald-500" : "bg-sky-500"}`} />
                  <View className="absolute top-10 right-10 w-24 h-24 rounded-full filter blur-2xl opacity-20 bg-amber-500" />
                  <View className="absolute bottom-10 left-10 w-20 h-20 rounded-full filter blur-2xl opacity-15 bg-rose-500" />
                </View>
              ) : (
                <View className="relative w-72 h-72 items-center justify-center">
                  <View className="absolute top-10 left-12 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-slate-500 shadow" />
                  <View className="absolute top-24 right-16 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-slate-500 shadow" />
                  <View className="absolute bottom-16 left-28 w-3.5 h-3.5 rounded-full bg-amber-500 border border-slate-500 shadow" />
                  <View className="absolute bottom-10 right-12 w-3.5 h-3.5 rounded-full bg-rose-500 border border-slate-500 shadow" />
                </View>
              )}

              <View className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 max-w-[280px] z-10 shadow-lg">
                <Text className="text-slate-100 font-bold text-xs text-center">Web Map Simulation</Text>
                <Text className="text-slate-400 text-3xs text-center mt-1 leading-relaxed">
                  Interactive react-native-maps Google Map renders on physical Android devices. Below is active GPS telemetry extracted from SQLite.
                </Text>
              </View>
            </View>

            {/* Right log details data list */}
            <View className="w-80 bg-slate-900 p-4">
              <Text className="text-slate-200 font-bold text-xs mb-3 uppercase tracking-wider">Telemetry Points ({logs.length})</Text>
              <ScrollView className="flex-1" contentContainerStyle={{ gap: 8 }}>
                {logs.map((log) => (
                  <View key={log.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-300 font-bold text-xs">{log.carrier || "WiFi"}</Text>
                      <Text className="text-slate-500 text-[9px]">{new Date(log.timestamp).toLocaleTimeString()}</Text>
                    </View>
                    <View className="flex-row justify-between mt-1.5 items-end">
                      <Text className="text-slate-500 font-mono text-[9px]">{log.latitude?.toFixed(4)}, {log.longitude?.toFixed(4)}</Text>
                      <Text className={`font-black text-xs ${log.signal && log.signal >= -90 ? "text-emerald-400" : log.signal && log.signal >= -105 ? "text-amber-400" : "text-rose-400"}`}>
                        {mode === "signal" ? (log.signal ? `${log.signal} dBm` : "—") : (log.download ? `${log.download.toFixed(1)} Mbps` : "—")}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        ) : (
          /* Native Google Maps Render */
          MapView && (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={{ width: "100%", height: "100%" }}
              initialRegion={defaultRegion}
              customMapStyle={darkMapStyle}
            >
              {/* Heatmap Overlay Layer */}
              {visual === "heatmap" && logs.length > 0 && Heatmap && (
                <Heatmap
                  points={getHeatmapPoints()}
                  radius={Platform.OS === "ios" ? 40 : 25}
                  opacity={0.8}
                  gradient={{
                    colors: mode === "signal" 
                      ? ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"] // Blue -> Green -> Orange -> Red
                      : ["#818cf8", "#38bdf8", "#34d399", "#f59e0b"],
                    startPoints: [0.1, 0.4, 0.7, 1.0],
                    colorMapSize: 256
                  }}
                />
              )}

              {/* Pin Markers Layer */}
              {visual === "pins" && logs.map((log) => (
                <Marker
                  key={log.id}
                  coordinate={{ latitude: log.latitude!, longitude: log.longitude! }}
                  pinColor={getMarkerColor(log)}
                  title={`${log.carrier || "WiFi"} • ${log.networkType}`}
                  description={
                    mode === "signal"
                      ? `Signal: ${log.signal ? `${log.signal} dBm` : "—"}`
                      : `Download: ${log.download ? `${log.download.toFixed(1)} Mbps` : "—"}`
                  }
                />
              ))}
            </MapView>
          )
        )}
      </View>
    </SafeAreaView>
  );
}

// Sleek dark-mode theme map style configuration for Google Maps SDK
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#64748b" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#475569" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#020617" }] }
];
