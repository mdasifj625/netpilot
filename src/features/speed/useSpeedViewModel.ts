import { useState, useEffect, useCallback, useRef } from "react";
import { Alert, Platform, Animated } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { desc, isNotNull } from "drizzle-orm";

import {
  startSpeedTest,
  stopSpeedTest,
  addPingFinishedListener,
  addPingProgressListener,
  addSpeedFinishedListener,
  addSpeedProgressListener,
} from "../../../modules/network-speed";
import { getCellularDetails } from "../../../modules/cellular-diagnostics";
import { db } from "../../database/db";
import { networkHistory } from "../../database/schema";
import { useAppStore } from "../../store/useAppStore";

export type TestStatus = "idle" | "ping" | "download" | "upload" | "finished";

export function useSpeedViewModel() {
  const { settings, updateSettings } = useAppStore();
  const [status, setStatus] = useState<TestStatus>("idle");
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);

  const handleToggleMultiConnection = (val: boolean) => {
    updateSettings({ isMultiConnection: val });
  };

  const [progress, setProgress] = useState(0);
  const [ping, setPing] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [downloadHistory, setDownloadHistory] = useState<number[]>([]);
  const [uploadHistory, setUploadHistory] = useState<number[]>([]);
  const [networkInfo, setNetworkInfo] = useState<{ ip: string; isp: string } | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === "ping" || status === "download" || status === "upload") {
      pulseAnim.setValue(1.0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1.0);
    }
  }, [status, pulseAnim]);

  useEffect(() => {
    if (status === "finished") {
      Animated.timing(fadeAnim, {
        toValue: 1.0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [status, fadeAnim]);

  useEffect(() => {
    if (status === "ping" || status === "download" || status === "upload") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (status === "finished") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [status]);

  const clearHistory = async () => {
    try {
      await db.delete(networkHistory);
      setHistory([]);
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
  };

  const fetchSpeedHistory = useCallback(async () => {
    try {
      const list = await db
        .select()
        .from(networkHistory)
        .where(isNotNull(networkHistory.download))
        .orderBy(desc(networkHistory.timestamp))
        .limit(10);
      setHistory(list.reverse());
    } catch (e) {
      console.error("Failed to query speed test history:", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSpeedHistory();

      fetch("https://api.ipify.org?format=json")
        .then((res) => res.json())
        .then((ipData) => {
          fetch(`https://ipwho.is/${ipData.ip}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.success) {
                setNetworkInfo({ ip: data.ip, isp: data.connection?.isp || data.connection?.org || "Unknown ISP" });
              }
            })
            .catch((err) => console.log("Failed to fetch ISP info:", err));
        })
        .catch((err) => console.log("Failed to fetch IP info:", err));
    }, [fetchSpeedHistory])
  );

  const DOWNLOAD_URL =
    settings.customDownloadUrl.trim() !== ""
      ? settings.customDownloadUrl.trim()
      : "https://speed.cloudflare.com/__down?bytes=250000000";
  const UPLOAD_URL =
    settings.customUploadUrl.trim() !== "" ? settings.customUploadUrl.trim() : "https://speed.cloudflare.com/__up";

  const downloadSpeedRef = useRef(downloadSpeed);
  const pingRef = useRef(ping);

  useEffect(() => {
    downloadSpeedRef.current = downloadSpeed;
  }, [downloadSpeed]);

  useEffect(() => {
    pingRef.current = ping;
  }, [ping]);

  const saveTestResult = useCallback(
    async (finalDownload: number, finalUpload: number) => {
      try {
        let cellCarrier = "WiFi Link";
        let connType = "WiFi";

        if (Platform.OS !== "web") {
          try {
            const cell = getCellularDetails();
            cellCarrier = cell && cell.length > 0 ? (cell[0].carrier ?? "WiFi Link") : "WiFi Link";
            connType = cell && cell.length > 0 ? (cell[0].networkType ?? "WiFi") : "WiFi";
          } catch {
            // ignore
          }
        }

        const finalPing = pingRef.current;
        await db.insert(networkHistory).values({
          timestamp: Date.now(),
          signal: null,
          carrier: cellCarrier,
          networkType: connType,
          download: finalDownload,
          upload: finalUpload,
          ping: finalPing,
          latitude: null,
          longitude: null,
        });
        fetchSpeedHistory();
        console.log("Speed test record saved successfully.");
      } catch (e) {
        console.error("Failed to save speed test history:", e);
      }
    },
    [fetchSpeedHistory]
  );

  const saveTestResultRef = useRef(saveTestResult);
  useEffect(() => {
    saveTestResultRef.current = saveTestResult;
  }, [saveTestResult]);

  useEffect(() => {
    const subPing = addPingFinishedListener((event) => {
      setPing(event.pingMs);
      setJitter(event.jitterMs);
      setStatus("download");
      setProgress(0);
    });

    const subPingProgress = addPingProgressListener((event) => {
      if (event.pingMs > 0) {
        setPing(event.pingMs);
      }
      setProgress(event.progress);
    });

    const subProgress = addSpeedProgressListener((event) => {
      setProgress(event.progress);
      if (event.type === "download") {
        setDownloadSpeed(event.speedMbps);
        setDownloadHistory((prev) => [...prev.slice(-30), event.speedMbps]);
      } else if (event.type === "upload") {
        setUploadSpeed(event.speedMbps);
        setUploadHistory((prev) => [...prev.slice(-30), event.speedMbps]);
      }
    });

    const subFinished = addSpeedFinishedListener((event) => {
      if (event.type === "download") {
        setDownloadSpeed(event.averageSpeedMbps);
        setStatus("upload");
        setProgress(0);
      } else if (event.type === "upload") {
        setUploadSpeed(event.averageSpeedMbps);
        setStatus("finished");
        setProgress(1);
        saveTestResultRef.current(downloadSpeedRef.current, event.averageSpeedMbps);
      }
    });

    return () => {
      subPing.remove();
      subPingProgress.remove();
      subProgress.remove();
      subFinished.remove();
      stopSpeedTest();
    };
  }, []);

  const handleStartTest = () => {
    if (status !== "idle" && status !== "finished") {
      stopSpeedTest();
      setStatus("idle");
      setProgress(0);
      return;
    }

    setPing(null);
    setJitter(null);
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setDownloadHistory([]);
    setUploadHistory([]);
    setProgress(0);
    setStatus("ping");

    const success = startSpeedTest(DOWNLOAD_URL, UPLOAD_URL, settings.isMultiConnection);
    if (!success) {
      Alert.alert("Error", "Could not initiate native speed test routine.");
      setStatus("idle");
    }
  };

  const currentSpeed = status === "download" ? downloadSpeed : status === "upload" ? uploadSpeed : 0;

  return {
    settings,
    status,
    isAdvancedExpanded,
    setIsAdvancedExpanded,
    handleToggleMultiConnection,
    progress,
    ping,
    jitter,
    downloadSpeed,
    uploadSpeed,
    history,
    downloadHistory,
    uploadHistory,
    networkInfo,
    pulseAnim,
    fadeAnim,
    clearHistory,
    handleStartTest,
    currentSpeed,
  };
}
