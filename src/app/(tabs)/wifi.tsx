import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { resolveMacVendor } from "../../utils/macVendors";
import { 
  Wifi, 
  Search, 
  Network, 
  RefreshCw, 
  Sliders, 
  Cpu, 
  Globe, 
  Signal, 
  CheckCircle, 
  HelpCircle,
  Laptop,
  Smartphone,
  Router,
  Server,
  Tablet,
  Tv
} from "lucide-react-native";

// Import custom native modules
import { 
  getConnectedWifiInfo, 
  getScanResults, 
  startScan as startWifiScan, 
  WifiScanResult, 
  ConnectedWifiInfo 
} from "../../../modules/wifi-analyzer";

import { 
  startScan as startLanScan, 
  stopScan as stopLanScan, 
  addDeviceFoundListener, 
  addScanFinishedListener, 
  addScanProgressListener, 
  DiscoveredDevice,
  scanDevicePorts
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
    if (host.includes("iphone") || host.includes("phone") || host.includes("android") || host.includes("galaxy") || host.includes("pixel")) {
      return <Smartphone size={16} color="#34d399" />;
    }
    if (host.includes("ipad") || host.includes("tablet")) {
      return <Tablet size={16} color="#a78bfa" />;
    }
    if (host.includes("tv") || host.includes("cast") || host.includes("player")) {
      return <Tv size={16} color="#f472b6" />;
    }
    if (host.includes("macbook") || host.includes("pc") || host.includes("desktop") || host.includes("laptop") || host.includes("win")) {
      return <Laptop size={16} color="#38bdf8" />;
    }
    if (host.includes("nas") || host.includes("server") || host.includes("cloud")) {
      return <Server size={16} color="#fbbf24" />;
    }
    return <Cpu size={16} color="#818cf8" />;
  };
  const [lanProgress, setLanProgress] = useState(0);
  const [isLanScanning, setIsLanScanning] = useState(false);

  const updateWifiData = () => {
    setIsWifiScanning(true);
    try {
      startWifiScan();
      const connected = getConnectedWifiInfo();
      const results = getScanResults();

      setConnectedInfo(connected);
      // Sort results by signal level descending
      setScanResults(results.sort((a, b) => b.level - a.level));
    } catch (e) {
      console.error("Failed to query WiFi metrics:", e);
    } finally {
      setIsWifiScanning(false);
    }
  };

  // Telephony/WiFi loop
  useFocusEffect(
    React.useCallback(() => {
      updateWifiData();
      const interval = setInterval(() => {
        if (!isLanScanning) {
          updateWifiData();
        }
      }, 5000);

      return () => {
        clearInterval(interval);
        stopLanScan();
      };
    }, [isLanScanning])
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

  // Helper to rate WiFi Channels based on overlapping networks
  const getChannelRecommendations = () => {
    // 2.4 GHz channels: 1, 6, 11 are non-overlapping
    const channels = [1, 6, 11];
    const congestion = { 1: 0, 6: 0, 11: 0 };
    
    scanResults.forEach((ap) => {
      if (ap.frequency >= 2400 && ap.frequency <= 2500) {
        if (ap.channel >= 1 && ap.channel <= 4) congestion[1]++;
        else if (ap.channel >= 5 && ap.channel <= 8) congestion[6]++;
        else if (ap.channel >= 9 && ap.channel <= 13) congestion[11]++;
      }
    });

    const ranked = channels.sort((a, b) => congestion[a as 1|6|11] - congestion[b as 1|6|11]);
    return {
      recommended: ranked[0],
      scores: congestion
    };
  };

  const channelInfo = getChannelRecommendations();

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-slate-950">
      {/* Sub Tabs Toggle */}
      <View className="flex-row mx-4 mt-4 bg-slate-900 border border-slate-800 rounded-xl p-1">
        <TouchableOpacity 
          onPress={() => setActiveTab("wifi")}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${activeTab === "wifi" ? "bg-sky-500" : "bg-transparent"}`}
        >
          <Wifi size={16} color={activeTab === "wifi" ? "#ffffff" : "#94a3b8"} />
          <Text className={`font-bold text-xs ${activeTab === "wifi" ? "text-white" : "text-slate-400"}`}>WiFi Analyzer</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab("lan")}
          className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-2 ${activeTab === "lan" ? "bg-sky-500" : "bg-transparent"}`}
        >
          <Network size={16} color={activeTab === "lan" ? "#ffffff" : "#94a3b8"} />
          <Text className={`font-bold text-xs ${activeTab === "lan" ? "text-white" : "text-slate-400"}`}>LAN Devices</Text>
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

              <View style={{ gap: 10 }}>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-semibold">SSID</Text>
                  <Text className="text-slate-200 text-xs font-bold">{connectedInfo.ssid}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-semibold">Frequency</Text>
                  <Text className="text-slate-200 text-xs font-semibold">{connectedInfo.frequency} MHz</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-semibold">Link Speed</Text>
                  <Text className="text-slate-200 text-xs font-bold">{connectedInfo.linkSpeed} Mbps</Text>
                </View>
                {connectedInfo.bssid && resolveMacVendor(connectedInfo.bssid) && (
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
                <Text className="text-sm font-bold text-slate-200">Channel Assessment (2.4 GHz)</Text>
              </View>
              
              <Text className="text-slate-400 text-xs mb-4 leading-relaxed">
                Channels 1, 6, and 11 do not overlap. The recommendation selects the channel with the lowest count of neighboring networks.
              </Text>

              <View className="bg-slate-950/40 rounded-2xl border border-slate-800/50 p-4" style={{ gap: 12 }}>
                <View className="flex-row justify-between items-center">
                  <Text className="text-slate-300 font-medium text-xs">Recommended Channel</Text>
                  <View className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                    <Text className="text-emerald-400 font-black text-xs">Channel {channelInfo.recommended}</Text>
                  </View>
                </View>
                
                <View className="border-t border-slate-800/50 pt-2.5" style={{ gap: 8 }}>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-xs">Ch 1 neighbors</Text>
                    <Text className="text-slate-300 font-semibold text-xs">{channelInfo.scores[1]} APs</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-xs">Ch 6 neighbors</Text>
                    <Text className="text-slate-300 font-semibold text-xs">{channelInfo.scores[6]} APs</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-500 text-xs">Ch 11 neighbors</Text>
                    <Text className="text-slate-300 font-semibold text-xs">{channelInfo.scores[11]} APs</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Scanned Access Points */}
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">Discovered Networks</Text>
            <TouchableOpacity onPress={updateWifiData} className="flex-row items-center gap-1">
              <RefreshCw size={12} color="#94a3b8" />
              <Text className="text-xs text-slate-400 font-medium">Scan</Text>
            </TouchableOpacity>
          </View>

          {scanResults.length > 0 ? (
            <View style={{ gap: 12 }}>
              {scanResults.map((item) => (
                <View key={item.bssid} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-row items-center justify-between shadow-md">
                  <View className="flex-1 pr-3">
                    <Text className="text-slate-200 font-bold text-sm" numberOfLines={1}>
                      {item.ssid || "Hidden Network"}
                    </Text>
                    <View className="flex-row gap-2 mt-1 items-center flex-wrap">
                      <Text className="text-slate-500 font-mono text-[10px]">{item.bssid}</Text>
                      <Text className="text-slate-500 text-[10px]">•</Text>
                      <Text className="text-sky-500 font-bold text-[10px]">Ch {item.channel}</Text>
                      <Text className="text-slate-500 text-[10px]">•</Text>
                      <Text className="text-slate-400 font-medium text-[10px]">{item.wifiStandard}</Text>
                    </View>
                  </View>
                  
                  <View className="items-end gap-1">
                    <View className="flex-row items-center gap-1">
                      <Signal size={12} color={item.level >= -70 ? "#10b981" : item.level >= -85 ? "#f59e0b" : "#f43f5e"} />
                      <Text className={`font-black text-xs ${item.level >= -70 ? "text-emerald-400" : item.level >= -85 ? "text-amber-400" : "text-rose-400"}`}>
                        {item.level} dBm
                      </Text>
                    </View>
                    <Text className="text-slate-500 text-[9px] font-semibold">{item.frequency} MHz</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 items-center justify-center py-12">
              <ActivityIndicator size="small" color="#0ea5e9" className="mb-3" />
              <Text className="text-slate-400 text-xs">Scanning surrounding WiFi access points...</Text>
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
                <View 
                  style={{ width: `${lanProgress * 100}%` }}
                  className="h-full bg-indigo-500"
                />
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
                        <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Common Port Audit</Text>
                        {isScanningPorts ? (
                          <ActivityIndicator size="small" color="#0ea5e9" className="my-1.5" />
                        ) : (
                          <View className="flex-row flex-wrap gap-2 mt-1">
                            {[22, 53, 80, 443, 8080].map((port) => {
                              const isOpen = openPorts.includes(port);
                              const portNames: Record<number, string> = {
                                22: "SSH",
                                53: "DNS",
                                80: "HTTP",
                                443: "HTTPS",
                                8080: "Web Alt"
                              };
                              return (
                                <View 
                                  key={port} 
                                  className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1.5 ${
                                    isOpen 
                                      ? "bg-emerald-500/10 border-emerald-500/25" 
                                      : "bg-slate-950/40 border-slate-800/60 opacity-60"
                                  }`}
                                >
                                  <View className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-400" : "bg-slate-600"}`} />
                                  <Text className={`font-bold text-[9px] uppercase tracking-wider ${isOpen ? "text-emerald-400" : "text-slate-500"}`}>
                                    {port} • {portNames[port]}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
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
                Click 'Start LAN Discovery' to map and ping all devices connected to this local router.
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
