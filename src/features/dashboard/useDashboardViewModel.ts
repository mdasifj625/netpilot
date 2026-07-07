import { useState, useCallback, useRef, useEffect } from "react";
import { Platform, Alert, Linking, Animated, PermissionsAndroid } from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";

import {
  getCellularDetails,
  getNetworkDetails,
  CellularDiagnosticsData,
  NetworkDetailsData,
} from "../../../modules/cellular-diagnostics";
import { getConnectedWifiInfo, ConnectedWifiInfo } from "../../../modules/wifi-analyzer";
import { useAppStore } from "../../store/useAppStore";

export function useDashboardViewModel() {
  const { settings } = useAppStore();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [cellDetails, setCellDetails] = useState<CellularDiagnosticsData[] | null>(null);
  const [netDetails, setNetDetails] = useState<NetworkDetailsData | null>(null);
  const [wifiDetails, setWifiDetails] = useState<ConnectedWifiInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [selectedSimIndex, setSelectedSimIndex] = useState(0);
  const [isSystemExpanded, setIsSystemExpanded] = useState(false);

  const fadeAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
  const slideAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(20))).current;

  useEffect(() => {
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
  }, [fadeAnims, slideAnims]);

  const fetchDiagnostics = useCallback(async () => {
    try {
      const perms = await Location.getForegroundPermissionsAsync();
      setPermissionGranted(perms.granted);

      if (perms.granted && Platform.OS !== "web") {
        setCellDetails(getCellularDetails());
        setNetDetails(getNetworkDetails());
        setWifiDetails(getConnectedWifiInfo());
      }
    } catch (e) {
      console.log("Diag error:", e);
    }
  }, []);

  const checkPermission = useCallback(async () => {
    try {
      const response = await Location.getForegroundPermissionsAsync();
      let isFine = response.status === "granted" && response.android?.accuracy === "fine";
      if (Platform.OS === "android") {
        const phoneState = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
        isFine = isFine && phoneState;
      }
      setPermissionGranted(isFine);
      return isFine;
    } catch {
      setPermissionGranted(false);
      return false;
    }
  }, []);

  const updateTelemetry = useCallback(() => {
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
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
      }
      const response = await Location.requestForegroundPermissionsAsync();
      let isFine = response.status === "granted" && response.android?.accuracy === "fine";
      
      if (Platform.OS === "android") {
        const phoneState = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
        isFine = isFine && phoneState;
      }
      
      setPermissionGranted(isFine);
      if (isFine) {
        updateTelemetry();
      } else if (response.status === "granted") {
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
    } catch (e) {
      console.error(e);
    }
  }, [updateTelemetry]);

  useFocusEffect(
    useCallback(() => {
      fetchDiagnostics();
    }, [fetchDiagnostics])
  );

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
      updateTelemetry();

      const interval = setInterval(() => {
        updateTelemetry();
      }, 2000);

      return () => clearInterval(interval);
    }, [checkPermission, requestPermission, updateTelemetry])
  );

  useFocusEffect(
    useCallback(() => {
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

  return {
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
  };
}
