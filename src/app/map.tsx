import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { desc, isNotNull } from "drizzle-orm";
import { 
  ArrowLeft, 
  MapPin, 
  Layers, 
  Radio, 
  Gauge
} from "lucide-react-native";
import * as Location from "expo-location";

// Import local database and schema
import { db } from "../database/db";
import { networkHistory, NetworkHistorySelect } from "../database/schema";

// Platform-conditional require for react-native-webview to prevent Web crash
let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch (e) {
    console.error("react-native-webview loading failed:", e);
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
  
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    fetchLogsAndLocation();
  }, []);

  useEffect(() => {
    if (logs.length > 0) {
      triggerMapUpdate(logs, mode, visual);
    }
  }, [logs, mode, visual, currentCoords]);

  const fetchLogsAndLocation = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch current GPS location for map centering
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        };
        setCurrentCoords(newCoords);
        centerMapOn(newCoords.latitude, newCoords.longitude);
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
        const firstLogCoords = {
          latitude: history[0].latitude,
          longitude: history[0].longitude
        };
        setCurrentCoords(firstLogCoords);
        centerMapOn(firstLogCoords.latitude, firstLogCoords.longitude);
      }
    } catch (e) {
      console.error("Failed to compile map telemetry details:", e);
    } finally {
      setLoading(false);
    }
  };

  const centerMapOn = (lat: number, lng: number) => {
    const js = `
      if (window.centerOn) {
        window.centerOn(${lat}, ${lng});
      }
      true;
    `;
    if (Platform.OS === "web") {
      try {
        (webViewRef.current as any)?.contentWindow?.eval(js);
      } catch (e) {
        console.warn("Failed to center web map frame:", e);
      }
    } else {
      webViewRef.current?.injectJavaScript(js);
    }
  };

  const triggerMapUpdate = (currentLogs: any[], currentMode: string, currentVisual: string) => {
    const js = `
      if (window.updateMapData) {
        window.updateMapData(
          ${JSON.stringify(currentLogs)},
          "${currentMode}",
          "${currentVisual}",
          ${currentCoords?.latitude || "null"},
          ${currentCoords?.longitude || "null"}
        );
      }
      true;
    `;
    if (Platform.OS === "web") {
      try {
        (webViewRef.current as any)?.contentWindow?.eval(js);
      } catch (e) {
        console.warn("Failed to update web map frame:", e);
      }
    } else {
      webViewRef.current?.injectJavaScript(js);
    }
  };

  // Helper to generate self-contained Leaflet HTML
  const getMapHtml = (initialLogs: any[], initialMode: string, initialVisual: string) => {
    const centerLat = currentCoords?.latitude ?? 40.7128;
    const centerLng = currentCoords?.longitude ?? -74.0060;
    const hasCurrentLoc = currentCoords !== null;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #020617;
    }
    /* Sleek custom popup styling */
    .leaflet-popup-content-wrapper {
      background: #0f172a !important;
      color: #f1f5f9 !important;
      border: 1px solid #334155;
      border-radius: 12px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .leaflet-popup-tip {
      background: #0f172a !important;
      border: 1px solid #334155;
    }
    .leaflet-popup-content {
      margin: 12px;
      font-size: 13px;
      line-height: 1.4;
    }
    .leaflet-popup-content b {
      color: #38bdf8;
    }
    .leaflet-control-zoom {
      border: 1px solid #334155 !important;
    }
    .leaflet-control-zoom-in, .leaflet-control-zoom-out {
      background-color: #0f172a !important;
      color: #f1f5f9 !important;
      border-bottom: 1px solid #334155 !important;
    }
    .leaflet-control-attribution {
      background: rgba(15, 23, 42, 0.8) !important;
      color: #64748b !important;
    }
    .leaflet-control-attribution a {
      color: #38bdf8 !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
  <script>
    var map;
    var heatLayer = null;
    var markerLayer = null;
    var initialCenter = [${centerLat}, ${centerLng}];

    map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView(initialCenter, 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    var currentLocMarker = null;
    var currentLocPulse = null;
    function updateCurrentLocation(lat, lng) {
      if (currentLocMarker) {
        currentLocMarker.setLatLng([lat, lng]);
      } else {
        currentLocMarker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: '#0ea5e9',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1
        }).addTo(map);
      }
      if (currentLocPulse) {
        currentLocPulse.setLatLng([lat, lng]);
      } else {
        currentLocPulse = L.circle([lat, lng], {
          radius: 30,
          color: '#0ea5e9',
          fillColor: '#0ea5e9',
          fillOpacity: 0.15,
          weight: 1
        }).addTo(map);
      }
    }

    if (${hasCurrentLoc}) {
      updateCurrentLocation(${centerLat}, ${centerLng});
    }

    var logsData = ${JSON.stringify(initialLogs)};
    var mapMode = "${initialMode}";
    var visualType = "${initialVisual}";

    function getMarkerColor(log, mode) {
      if (mode === "signal") {
        var val = log.signal || -110;
        if (val >= -85) return "#10b981";
        if (val >= -100) return "#f59e0b";
        return "#ef4444";
      } else {
        var val = log.download || 0;
        if (val >= 40) return "#10b981";
        if (val >= 15) return "#f59e0b";
        return "#ef4444";
      }
    }

    function renderMap() {
      if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
      }
      if (markerLayer) {
        map.removeLayer(markerLayer);
        markerLayer = null;
      }

      if (visualType === "heatmap") {
        var heatPoints = [];
        logsData.forEach(function(log) {
          if (log.latitude && log.longitude) {
            var weight = 1;
            if (mapMode === "signal" && log.signal) {
              weight = Math.max(1, Math.min(10, Math.round((log.signal + 140) / 10)));
            } else if (mapMode === "speed" && log.download) {
              weight = Math.max(1, Math.min(10, Math.round(log.download / 10)));
            }
            heatPoints.push([log.latitude, log.longitude, weight / 10]);
          }
        });

        heatLayer = L.heatLayer(heatPoints, {
          radius: 25,
          blur: 15,
          max: 1.0,
          gradient: {
            0.2: '#ef4444',
            0.4: '#f59e0b',
            0.7: '#eab308',
            0.9: '#22c55e',
            1.0: '#0ea5e9'
          }
        }).addTo(map);

      } else {
        markerLayer = L.layerGroup().addTo(map);
        logsData.forEach(function(log) {
          if (log.latitude && log.longitude) {
            var color = getMarkerColor(log, mapMode);
            var title = (log.carrier || "WiFi") + " • " + (log.networkType || "Unknown");
            var desc = mapMode === "signal" 
              ? "Signal: " + (log.signal ? log.signal + " dBm" : "—") 
              : "Download: " + (log.download ? log.download.toFixed(1) + " Mbps" : "—");
            
            var popupContent = "<div><b>" + title + "</b><br/>" + desc + "<br/><span style='font-size:10px; color:#64748b;'>" + new Date(log.timestamp).toLocaleTimeString() + "</span></div>";

            L.circleMarker([log.latitude, log.longitude], {
              radius: 6,
              fillColor: color,
              color: '#020617',
              weight: 1,
              fillOpacity: 0.9
            })
            .bindPopup(popupContent)
            .addTo(markerLayer);
          }
        });
      }
    }

    window.updateMapData = function(newLogs, newMode, newVisual, currentLat, currentLng) {
      logsData = newLogs;
      mapMode = newMode;
      visualType = newVisual;
      renderMap();
      if (currentLat && currentLng) {
        updateCurrentLocation(currentLat, currentLng);
      }
    };

    window.centerOn = function(lat, lng) {
      map.setView([lat, lng], 15);
    };

    renderMap();
  </script>
</body>
</html>
    `;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#020617" }} className="flex-1 bg-slate-950">
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

      {/* Main Map Viewer Canvas */}
      <View style={{ flex: 1 }} className="flex-1 bg-slate-900 w-full h-full relative">
        {loading ? (
          <View className="absolute inset-0 items-center justify-center bg-slate-900 z-10">
            <ActivityIndicator size="large" color="#0ea5e9" />
          </View>
        ) : null}

        {Platform.OS === "web" ? (
          /* Web Split View: Actual Map left, telemetry records list right */
          <View className="w-full h-full flex-row">
            <View className="flex-1 bg-slate-950 justify-center items-center relative overflow-hidden">
              <iframe
                srcDoc={getMapHtml(logs, mode, visual)}
                style={{ width: "100%", height: "100%", border: "none" }}
                ref={webViewRef as any}
              />
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
          /* Native OpenStreetMap Render inside WebView */
          WebView && (
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: getMapHtml(logs, mode, visual) }}
              style={{ width: "100%", height: "100%", backgroundColor: "#020617" }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          )
        )}

        {/* Floating Controls (Compact Circular FABs) */}
        <View className="absolute bottom-6 right-4 gap-3 z-50">
          {/* Toggle Mode FAB (Signal vs Speed) */}
          <TouchableOpacity 
            onPress={() => setMode(prev => prev === "signal" ? "speed" : "signal")}
            className="w-12 h-12 rounded-full bg-slate-950/90 border border-slate-800 items-center justify-center shadow-2xl active:bg-slate-900"
          >
            {mode === "signal" ? (
              <Radio size={20} color="#0ea5e9" />
            ) : (
              <Gauge size={20} color="#10b981" />
            )}
          </TouchableOpacity>

          {/* Toggle Visual FAB (Heatmap vs Pins) */}
          <TouchableOpacity 
            onPress={() => setVisual(prev => prev === "heatmap" ? "pins" : "heatmap")}
            className="w-12 h-12 rounded-full bg-slate-950/90 border border-slate-800 items-center justify-center shadow-2xl active:bg-slate-900"
          >
            {visual === "heatmap" ? (
              <Layers size={20} color="#0ea5e9" />
            ) : (
              <MapPin size={20} color="#a78bfa" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
