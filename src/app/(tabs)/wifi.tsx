import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Alert, Linking } from "react-native";
import Svg, { Polyline } from "react-native-svg";

import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { resolveMacVendor } from "../../utils/macVendors";
import {
  Wifi,
  Network,
  RefreshCw,
  Sliders,
  Cpu,
  Globe,
  Signal,
  CheckCircle,
  Laptop,
  Smartphone,
  Router,
  Server,
  Tablet,
  Tv,
  AlertTriangle,
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
} from "lucide-react-native";

// Import custom native modules
import {
  getConnectedWifiInfo,
  getScanResults,
  startScan as startWifiScan,
  WifiScanResult,
  ConnectedWifiInfo,
} from "../../../modules/wifi-analyzer";

import {
  startScan as startLanScan,
  stopScan as stopLanScan,
  addDeviceFoundListener,
  addScanFinishedListener,
  addScanProgressListener,
  DiscoveredDevice,
  scanDevicePorts,
} from "../../../modules/lan-scanner";

export default function WifiScreen() {
  const [activeTab, setActiveTab] = useState<"wifi" | "lan">("wifi");

  // WiFi State
  const [connectedInfo, setConnectedInfo] = useState<ConnectedWifiInfo | null>(null);
  const [scanResults, setScanResults] = useState<WifiScanResult[]>([]);
  const [isWifiScanning, setIsWifiScanning] = useState(false);

  // LAN Scanner State
  const [lanDevices, setLanDevices] = useState<DiscoveredDevice[]>([]);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [openPorts, setOpenPorts] = useState<number[]>([]);
  const [isScanningPorts, setIsScanningPorts] = useState(false);
  const [signalHistory, setSignalHistory] = useState<number[]>([]);

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleDevicePress = async (ip: string) => {
    if (selectedIp === ip) {
      setSelectedIp(null);
      setOpenPorts([]);
      return;
    }

    setSelectedIp(ip);
    setIsScanningPorts(true);
    setOpenPorts([]);

    try {
      const ports = await scanDevicePorts(ip);
      setOpenPorts(ports);
    } catch (e) {
      console.error("Failed to scan device ports:", e);
    } finally {
      setIsScanningPorts(false);
    }
  };

  const getDeviceIcon = (hostname: string | null) => {
    if (!hostname) return <Cpu size={16} color="#818cf8" />;
    const host = hostname.toLowerCase();

    if (host.includes("gateway") || host.includes("router") || host.includes("modem") || host.includes("ap")) {
      return <Router size={16} color="#0ea5e9" />;
    }
    if (
      host.includes("iphone") ||
      host.includes("phone") ||
      host.includes("android") ||
      host.includes("galaxy") ||
      host.includes("pixel")
    ) {
      return <Smartphone size={16} color="#34d399" />;
    }
    if (host.includes("ipad") || host.includes("tablet")) {
      return <Tablet size={16} color="#a78bfa" />;
    }
    if (host.includes("tv") || host.includes("cast") || host.includes("player")) {
      return <Tv size={16} color="#f472b6" />;
    }
    if (
      host.includes("macbook") ||
      host.includes("pc") ||
      host.includes("desktop") ||
      host.includes("laptop") ||
      host.includes("win")
    ) {
      return <Laptop size={16} color="#38bdf8" />;
    }
    if (host.includes("nas") || host.includes("server") || host.includes("cloud")) {
      return <Server size={16} color="#fbbf24" />;
    }
    return <Cpu size={16} color="#818cf8" />;
  };
  const [lanProgress, setLanProgress] = useState(0);
  const [isLanScanning, setIsLanScanning] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const updateWifiData = useCallback(() => {
    setIsWifiScanning(true);
    try {
      startWifiScan();
      const connected = getConnectedWifiInfo();
      const results = getScanResults();

      setConnectedInfo(connected);
      if (connected && connected.level !== null) {
        setSignalHistory(prev => {
          const next = [...prev, connected.level as number];
          if (next.length > 30) next.shift(); // Keep last 30 samples (~2.5 mins if polling every 5s)
          return next;
        });
      }

      // Sort results by signal level descending
      setScanResults([...results].sort((a, b) => b.level - a.level));

      // Discard infinite search if absolutely no wifi is found
      if (results.length === 0) {
        stopPolling();
      }
    } catch (e) {
      console.error("Failed to query WiFi metrics:", e);
    } finally {
      setIsWifiScanning(false);
    }
  }, [stopPolling]);

  const checkPermission = useCallback(async () => {
    try {
      const response = await Location.getForegroundPermissionsAsync();
      const isFine = response.status === "granted" && response.android?.accuracy === "fine";
      setPermissionGranted(isFine);
      return isFine;
    } catch {
      setPermissionGranted(false);
      return false;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      const isFine = response.status === "granted" && response.android?.accuracy === "fine";
      setPermissionGranted(isFine);
      if (isFine) {
        updateWifiData();
      } else {
        if (response.status === "granted") {
          Alert.alert(
            "Precise Location Required",
            "You enabled 'Approximate Location'. To scan local WiFi networks and read signal strengths, NetPilot needs 'Precise Location'.\n\nPlease enable it in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert(
            "Permission Required",
            "Location permission is required to read WiFi details and network hardware states."
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [updateWifiData]);

  // Telephony/WiFi loop
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
      updateWifiData();

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (!isLanScanning) {
          updateWifiData();
        }
      }, 5000);

      return () => {
        stopPolling();
        stopLanScan();
      };
    }, [isLanScanning, checkPermission, requestPermission, updateWifiData, stopPolling])
  );

  // Set up LAN Scanner listeners
  useEffect(() => {
    const subDevice = addDeviceFoundListener((device) => {
      setLanDevices((prev) => {
        // Prevent duplicate IP additions
        if (prev.some((d) => d.ip === device.ip)) return prev;
        return [...prev, device].sort((a, b) => {
          // Sort IP addresses numerically
          const aParts = a.ip.split(".").map(Number);
          const bParts = b.ip.split(".").map(Number);
          for (let i = 0; i < 4; i++) {
            if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
          }
          return 0;
        });
      });
    });

    const subProgress = addScanProgressListener((event) => {
      setLanProgress(event.progress);
    });

    const subFinished = addScanFinishedListener((event) => {
      setIsLanScanning(false);
      setLanProgress(1);
    });

    return () => {
      subDevice.remove();
      subProgress.remove();
      subFinished.remove();
    };
  }, []);

  const handleStartLanScan = () => {
    if (isLanScanning) {
      stopLanScan();
      setIsLanScanning(false);
      return;
    }

    setLanDevices([]);
    setLanProgress(0);
    setIsLanScanning(true);

    const success = startLanScan();
    if (!success) {
      setIsLanScanning(false);
      alert("Could not start LAN Scanner. Ensure you are connected to a WiFi network.");
    }
  };

  // Helper to rate WiFi Channels based on overlapping networks dynamically for 2.4 GHz and 5 GHz
  const getChannelRecommendations = () => {
    const is5G = connectedInfo?.frequency && connectedInfo.frequency >= 5000;

    if (is5G) {
      const channels5G = [36, 40, 44, 48, 149, 153, 157, 161];
      const congestion5G: Record<number, number> = { 36: 0, 40: 0, 44: 0, 48: 0, 149: 0, 153: 0, 157: 0, 161: 0 };

      scanResults.forEach((ap) => {
        if (ap.frequency >= 5000) {
          const ch = ap.channel;
          if (ch in congestion5G) {
            congestion5G[ch]++;
          }
        }
      });

      const ranked = [...channels5G].sort((a, b) => congestion5G[a] - congestion5G[b]);
      return {
        band: "5 GHz",
        recommended: ranked[0],
        scores: congestion5G,
        channels: channels5G,
      };
    } else {
      const channels2G = [1, 6, 11];
      const congestion2G: Record<number, number> = { 1: 0, 6: 0, 11: 0 };

      scanResults.forEach((ap) => {
        if (ap.frequency >= 2400 && ap.frequency <= 2500) {
          const ch = ap.channel;
          if (ch >= 1 && ch <= 4) congestion2G[1]++;
          else if (ch >= 5 && ch <= 8) congestion2G[6]++;
          else if (ch >= 9 && ch <= 13) congestion2G[11]++;
        }
      });

      const sorted2G = [...channels2G].sort((a, b) => congestion2G[a] - congestion2G[b]);
      return {
        band: "2.4 GHz",
        recommended: sorted2G[0],
        scores: congestion2G,
        channels: channels2G,
      };
    }
  };

  const channelInfo = getChannelRecommendations();

  const renderPortAudit = () => {
    if (isScanningPorts) {
      return (
        <View className="flex-row items-center gap-2 my-2">
          <ActivityIndicator size="small" color="#0ea5e9" />
          <Text className="text-slate-500 text-[10px]">Probing ports in parallel...</Text>
        </View>
      );
    }

    if (openPorts.length > 0) {
      return (
        <View className="flex-row flex-wrap gap-2 mt-1">
          {openPorts.map((port) => {
            const portNames: Record<number, string> = {
              21: "FTP",
              22: "SSH",
              23: "Telnet",
              25: "SMTP",
              53: "DNS",
              80: "HTTP",
              111: "RPC",
              139: "NetBIOS",
              443: "HTTPS",
              445: "SMB",
              631: "IPP/Print",
              3306: "MySQL",
              3389: "RDP",
              5000: "UPnP",
              5432: "PostgreSQL",
              5555: "Android ADB",
              6379: "Redis",
              8000: "Dev Web",
              8080: "Web Alt",
              8081: "Metro Bundler",
              8443: "HTTPS Alt",
              27017: "MongoDB",
            };
            return (
              <View
                key={port}
                className="px-3 py-1.5 rounded-xl border flex-row items-center gap-1.5 bg-emerald-500/10 border-emerald-500/25"
              >
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <Text className="font-bold text-[9px] uppercase tracking-wider text-emerald-400">
                  {port} • {portNames[port] || "Open"}
                </Text>
              </View>
            );
          })}
        </View>
      );
    }

    return (
      <View className="bg-slate-900 border border-slate-800 rounded-xl p-3 items-center mt-1">
        <Shield size={16} color="#10b981" className="mb-1.5" />
        <Text className="text-slate-400 font-semibold text-[10px]">No common ports open (Secure)</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }} className="flex-1">
      <View style={{ flex: 1 }}>
        {/* Precise Location Explainer Card */}
        {permissionGranted === false && (
        <View
          className="bg-slate-900 border border-amber-500/35 rounded-3xl p-5 mx-4 mt-6 shadow-lg"
          style={{ gap: 12 }}
        >
          <View className="flex-row items-center gap-2.5">
            <AlertTriangle size={20} color="#f59e0b" />
            <Text className="text-sm font-bold text-amber-200">Precise Location Required</Text>
          </View>
          <Text className="text-slate-400 text-xs leading-relaxed">
            Android restricts apps from reading WiFi access points or signal metrics unless you authorize Precise
            Location access. Your data is 100% private.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            className="bg-amber-500 py-2.5 rounded-xl items-center justify-center active:bg-amber-600 mt-2"
          >
            <Text className="text-slate-950 font-black text-xs uppercase tracking-wider">Enable Location Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sub Tabs Toggle */}
      <View className={`flex-row mx-4 bg-slate-900 border border-slate-800 rounded-xl p-1 ${permissionGranted === false ? "mt-4" : "mt-6"}`}>
        <TouchableOpacity
          onPress={() => setActiveTab("wifi")}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${activeTab === "wifi" ? "bg-sky-500" : "bg-transparent"}`}
        >
          <Wifi size={16} color={activeTab === "wifi" ? "#ffffff" : "#94a3b8"} />
          <Text className={`font-bold text-xs ${activeTab === "wifi" ? "text-white" : "text-slate-400"}`}>
            WiFi Analyzer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("lan")}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${activeTab === "lan" ? "bg-sky-500" : "bg-transparent"}`}
        >
          <Network size={16} color={activeTab === "lan" ? "#ffffff" : "#94a3b8"} />
          <Text className={`font-bold text-xs ${activeTab === "lan" ? "text-white" : "text-slate-400"}`}>
            LAN Devices
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "wifi" ? (
        <ScrollView className="flex-1 px-4 mt-4" contentContainerStyle={{ paddingBottom: 24, gap: 20 }}>
          {/* Connected Wifi Details */}
          {connectedInfo?.ssid ? (
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <View className="flex-row justify-between items-center mb-4 border-b border-slate-800/50 pb-3">
                <View className="flex-row items-center gap-2.5">
                  <CheckCircle size={18} color="#10b981" />
                  <Text className="text-sm font-black text-slate-100">Connected Wi-Fi</Text>
                </View>
                <Text className="text-slate-400 font-mono text-xs">{connectedInfo.bssid}</Text>
              </View>

              {/* Signal Strength Metaphor Bar */}
              {connectedInfo.level != null && (
                <View className="mb-4 bg-slate-950/40 border border-slate-800/40 p-3.5 rounded-2xl">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Signal Strength
                    </Text>
                    <Text
                      className={`text-xs font-black ${
                        connectedInfo.level >= -55
                          ? "text-emerald-400"
                          : connectedInfo.level >= -70
                            ? "text-teal-400"
                            : connectedInfo.level >= -85
                              ? "text-amber-400"
                              : "text-rose-400"
                      }`}
                    >
                      {connectedInfo.level} dBm •{" "}
                      {connectedInfo.level >= -55
                        ? "Excellent"
                        : connectedInfo.level >= -70
                          ? "Good"
                          : connectedInfo.level >= -85
                            ? "Fair"
                            : "Poor"}
                    </Text>
                  </View>
                  <View className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <View
                      style={{
                        width: `${Math.max(0, Math.min(100, (connectedInfo.level + 100) * 1.66))}%`, // Maps -100..-40 to 0..100%
                      }}
                      className={`h-full ${
                        connectedInfo.level >= -55
                          ? "bg-emerald-500"
                          : connectedInfo.level >= -70
                            ? "bg-teal-400"
                            : connectedInfo.level >= -85
                              ? "bg-amber-400"
                              : "bg-rose-500"
                      }`}
                    />
                  </View>

                  {/* Sweet Spot Graph */}
                  {signalHistory.length > 2 && (
                    <View className="mt-4 border-t border-slate-800/40 pt-3">
                      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Signal Sweet Spot Finder</Text>
                      <View className="h-12 bg-slate-950 rounded-xl overflow-hidden justify-end">
                        <Svg width="100%" height="100%" preserveAspectRatio="none">
                          <Polyline
                            points={signalHistory.map((val, idx) => {
                              const x = (idx / (Math.max(30, signalHistory.length) - 1)) * 300; // approximate width scale
                              const normalized = Math.max(0, Math.min(100, (val + 100) * 1.66));
                              const y = 48 - (normalized / 100) * 48;
                              return `${x},${y}`;
                            }).join(" ")}
                            fill="none"
                            stroke={connectedInfo.level >= -55 ? "#10b981" : connectedInfo.level >= -70 ? "#2dd4bf" : connectedInfo.level >= -85 ? "#fbbf24" : "#f43f5e"}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                      <Text className="text-[9px] text-slate-500 mt-1.5 text-center italic">Walk around to find the best signal peak.</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={{ gap: 10 }}>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-semibold">SSID</Text>
                  <Text className="text-slate-200 text-xs font-bold">{connectedInfo.ssid}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-semibold">Security</Text>
                  <View className="flex-row items-center gap-1.5">
                    {(() => {
                      const connectedAp = scanResults.find(r => r.bssid === connectedInfo.bssid);
                      const isSecure = connectedAp ? !connectedAp.capabilities.toLowerCase().includes("none") && !connectedAp.capabilities.toLowerCase().includes("open") : true;
                      return (
                        <>
                          {isSecure ? <Shield size={12} color="#10b981" /> : <ShieldAlert size={12} color="#f43f5e" />}
                          <Text className={`text-xs font-bold ${isSecure ? "text-emerald-400" : "text-rose-400"}`}>{isSecure ? "Secured Network" : "Open Network (Insecure)"}</Text>
                        </>
                      );
                    })()}
                  </View>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-semibold">Frequency</Text>
                  <Text className="text-slate-200 text-xs font-semibold">{connectedInfo.frequency} MHz</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-semibold">Link Speed</Text>
                  <Text className="text-slate-200 text-xs font-bold">{connectedInfo.linkSpeed} Mbps</Text>
                </View>
                {!!(connectedInfo.bssid) && !!(resolveMacVendor(connectedInfo.bssid)) && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-xs font-semibold">Manufacturer</Text>
                    <Text className="text-slate-200 text-xs font-bold">{resolveMacVendor(connectedInfo.bssid)}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex-row items-center gap-3">
              <Wifi size={24} color="#64748b" />
              <View>
                <Text className="text-slate-200 font-bold text-sm">Not Connected to WiFi</Text>
                <Text className="text-slate-500 text-xs">Connect to a router to see channel ratings</Text>
              </View>
            </View>
          )}

          {/* Recommended Channels */}
          {scanResults.length > 0 && (
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <View className="flex-row items-center gap-2 mb-3">
                <Sliders size={18} color="#0ea5e9" />
                <Text className="text-sm font-bold text-slate-200">Channel Assessment ({channelInfo.band})</Text>
              </View>

              <Text className="text-slate-400 text-xs mb-4 leading-relaxed">
                {channelInfo.band === "5 GHz"
                  ? "Assesses congestion on common 5 GHz channels. Recommends the channel block with the least neighboring traffic."
                  : "Channels 1, 6, and 11 do not overlap on 2.4 GHz. Recommends the channel with the lowest count of neighboring networks."}
              </Text>

              <View className="bg-slate-950/40 rounded-2xl border border-slate-800/50 p-4" style={{ gap: 12 }}>
                <View className="flex-row justify-between items-center">
                  <Text className="text-slate-300 font-medium text-xs">Recommended Channel</Text>
                  <View className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                    <Text className="text-emerald-400 font-black text-xs">Channel {channelInfo.recommended}</Text>
                  </View>
                </View>

                <View className="border-t border-slate-800/50 pt-2.5" style={{ gap: 8 }}>
                  {channelInfo.channels.map((ch) => (
                    <View key={ch} className="flex-row justify-between items-center">
                      <Text className="text-slate-500 text-xs">Ch {ch} neighbors</Text>
                      <Text className="text-slate-300 font-semibold text-xs">{channelInfo.scores[ch]} APs</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Scanned Access Points */}
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">
              Discovered Networks
            </Text>
            <TouchableOpacity
              onPress={updateWifiData}
              disabled={isWifiScanning}
              className="flex-row items-center gap-1.5"
            >
              {isWifiScanning ? (
                <ActivityIndicator size="small" color="#38bdf8" style={{ transform: [{ scale: 0.7 }] }} />
              ) : (
                <RefreshCw size={12} color="#94a3b8" />
              )}
              <Text className="text-xs text-slate-400 font-medium">{isWifiScanning ? "Scanning..." : "Scan"}</Text>
            </TouchableOpacity>
          </View>

          {scanResults.length > 0 ? (
            <View style={{ gap: 12 }}>
              {scanResults.map((item) => {
                const isOpen = item.capabilities.toLowerCase().includes("none") || item.capabilities.toLowerCase().includes("open");
                return (
                  <View
                    key={item.bssid}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <View className="flex-row items-center gap-2 mb-0.5">
                          {isOpen ? <Unlock size={14} color="#f43f5e" /> : <Lock size={14} color="#10b981" />}
                          <Text className="text-slate-200 font-bold text-sm" numberOfLines={1}>
                            {item.ssid || "Hidden Network"}
                          </Text>
                        </View>
                        <Text className="text-slate-500 font-mono text-[10px] mt-0.5 mb-1.5">{item.bssid}</Text>
                        <View className="flex-row gap-2 items-center flex-wrap">
                          <Text className="text-sky-500 font-bold text-[10px] px-1.5 py-0.5 bg-sky-500/10 rounded-md">Ch {item.channel}</Text>
                          <Text className="text-indigo-400 font-semibold text-[10px] px-1.5 py-0.5 bg-indigo-500/10 rounded-md">{item.wifiStandard}</Text>
                          <Text className={`font-bold text-[10px] px-1.5 py-0.5 rounded-md ${isOpen ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>{isOpen ? "Open" : "Secured"}</Text>
                        </View>
                      </View>

                      <View className="items-end justify-center">
                        <View className="flex-row items-center gap-1.5 mb-1">
                          <Signal
                            size={14}
                            color={item.level >= -70 ? "#10b981" : item.level >= -85 ? "#f59e0b" : "#f43f5e"}
                          />
                          <Text
                            className={`font-black text-sm ${item.level >= -70 ? "text-emerald-400" : item.level >= -85 ? "text-amber-400" : "text-rose-400"}`}
                          >
                            {item.level}
                          </Text>
                        </View>
                        <Text className="text-slate-500 text-[10px] font-semibold">{item.frequency} MHz</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 items-center justify-center py-12">
              {isWifiScanning ? (
                <>
                  <ActivityIndicator size="small" color="#0ea5e9" className="mb-3" />
                  <Text className="text-slate-400 text-xs">Scanning surrounding WiFi access points...</Text>
                </>
              ) : (
                <>
                  <Wifi size={32} color="#475569" className="mb-3" />
                  <Text className="text-slate-400 font-semibold text-sm">No Networks Found</Text>
                  <Text className="text-slate-500 text-xs text-center mt-1 max-w-[240px]">
                    Tap the Scan button above to search for nearby access points manually.
                  </Text>
                </>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        // LAN Devices Scanner Tab
        <View className="flex-1 px-4 mt-4">
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2">
                <Network size={18} color="#818cf8" />
                <Text className="text-sm font-bold text-slate-200">Local Network Discovery</Text>
              </View>
              {isLanScanning && (
                <Text className="text-slate-400 font-mono text-[10px]">{(lanProgress * 100).toFixed(0)}%</Text>
              )}
            </View>

            {isLanScanning && (
              <View className="w-full bg-slate-950/40 border border-slate-800/40 h-2.5 rounded-full overflow-hidden mb-5">
                <View style={{ width: `${lanProgress * 100}%` }} className="h-full bg-indigo-500" />
              </View>
            )}

            <TouchableOpacity
              onPress={handleStartLanScan}
              className={`w-full py-3 rounded-xl justify-center items-center ${isLanScanning ? "bg-slate-800 border border-slate-700 active:bg-slate-700" : "bg-indigo-500 active:bg-indigo-600"}`}
            >
              <Text className="text-white font-extrabold text-sm uppercase tracking-wider">
                {isLanScanning ? "Cancel Scan" : "Start LAN Discovery"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* List of Discovered Hosts */}
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">
            Active Discovered Devices ({lanDevices.length})
          </Text>

          {lanDevices.length > 0 ? (
            <FlatList
              data={lanDevices}
              keyExtractor={(item) => item.ip}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const isSelected = selectedIp === item.ip;
                return (
                  <TouchableOpacity
                    onPress={() => handleDevicePress(item.ip)}
                    activeOpacity={0.8}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3 shadow-md"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <View className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
                          {getDeviceIcon(item.hostname)}
                        </View>
                        <View className="flex-1">
                          <Text className="text-slate-200 font-bold text-sm">{item.ip}</Text>
                          <Text className="text-slate-500 font-medium text-xs mt-0.5" numberOfLines={1}>
                            {item.hostname || "Unknown Host"}
                          </Text>
                        </View>
                      </View>

                      <View className="items-end">
                        <Text className="text-indigo-400 font-bold text-xs">{item.ping.toFixed(1)} ms</Text>
                        <Text className="text-slate-500 text-[9px] font-semibold mt-0.5">Response Time</Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View className="mt-4 pt-3.5 border-t border-slate-800/60" style={{ gap: 8 }}>
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Deep Port Audit (20 Common Services)
                        </Text>
                        {renderPortAudit()}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          ) : (
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 items-center justify-center py-16 flex-1">
              <Globe size={32} color="#475569" className="mb-3" />
              <Text className="text-slate-400 font-semibold text-sm text-center">No Devices Scanned</Text>
              <Text className="text-slate-500 text-xs text-center mt-1.5 max-w-[240px]">
                Click Start LAN Discovery to map and ping all devices connected to this local router.
              </Text>
            </View>
          )}
        </View>
      )}
      </View>
    </View>
  );
}
