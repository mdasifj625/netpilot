import { useState, useEffect, useCallback, useRef } from "react";
import { Alert, Linking } from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";

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

export function useWifiViewModel() {
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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        setSignalHistory((prev) => {
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

  useFocusEffect(
    useCallback(() => {
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

  useEffect(() => {
    const subDevice = addDeviceFoundListener((device) => {
      setLanDevices((prev) => {
        if (prev.some((d) => d.ip === device.ip)) return prev;
        return [...prev, device].sort((a, b) => {
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
      Alert.alert("Error", "Could not start LAN Scanner. Ensure you are connected to a WiFi network.");
    }
  };

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

  return {
    activeTab,
    setActiveTab,
    connectedInfo,
    scanResults,
    isWifiScanning,
    lanDevices,
    selectedIp,
    openPorts,
    isScanningPorts,
    signalHistory,
    handleDevicePress,
    lanProgress,
    isLanScanning,
    permissionGranted,
    requestPermission,
    handleStartLanScan,
    channelInfo,
  };
}
