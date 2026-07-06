import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { desc, isNotNull } from "drizzle-orm";
import { ArrowDown, ArrowUp, Clock, Zap } from "lucide-react-native";

// Import custom native modules and DB
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
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const Speedometer = ({ speed }: { speed: number }) => {
  const startAngle = 135;
  const sweepAngle = 270;
  const r = 95;
  const cx = 120;
  const cy = 120;

  // Set up animated value for smooth transitions
  const animatedSpeed = React.useRef(new Animated.Value(0)).current;
  const [displaySpeed, setDisplaySpeed] = React.useState(0);
  const rippleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Add listener to update display speed state on every frame of animation
    const listenerId = animatedSpeed.addListener(({ value }) => {
      setDisplaySpeed(value);
    });

    Animated.timing(animatedSpeed, {
      toValue: speed,
      duration: 250, // 250ms transition for fluid motion
      useNativeDriver: false, // required for SVG properties and intermediate values
    }).start();

    return () => {
      animatedSpeed.removeListener(listenerId);
    };
  }, [speed, animatedSpeed]);

  // Handle ripple animation loop
  const isMoving = speed > 0.5;
  React.useEffect(() => {
    if (isMoving) {
      rippleAnim.setValue(0);
      Animated.loop(
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: false,
        })
      ).start();
    } else {
      rippleAnim.setValue(0);
      rippleAnim.stopAnimation();
    }
  }, [isMoving, rippleAnim]);

  // Determine dynamic target scale
  const getTargetMax = (currentSpeed: number) => {
    let max = 100;
    if (currentSpeed > 450) max = 1000;
    else if (currentSpeed > 180) max = 500;
    else if (currentSpeed > 90) max = 200;
    return max;
  };

  const targetMax = getTargetMax(speed > 0 ? speed : displaySpeed);

  React.useEffect(() => {
    if (speed > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [targetMax, speed]);

  // Animate the scale itself to create the anti-clockwise rotation effect
  const animatedMax = React.useRef(new Animated.Value(100)).current;
  const [displayMax, setDisplayMax] = React.useState(100);

  React.useEffect(() => {
    const listenerId = animatedMax.addListener(({ value }) => {
      setDisplayMax(value);
    });

    Animated.timing(animatedMax, {
      toValue: targetMax,
      duration: 600, // smooth scale transition
      useNativeDriver: false,
    }).start();

    return () => {
      animatedMax.removeListener(listenerId);
    };
  }, [targetMax, animatedMax]);

  // Generate ticks and labels based on targetMax
  const getScaleElements = (max: number) => {
    const ticksCount = 10;
    const ticks: number[] = [];
    for (let i = 0; i <= ticksCount; i++) {
      ticks.push(Math.round((max / ticksCount) * i));
    }

    const labelTicks: number[] = [];
    const labelsCount = 5;
    for (let i = 0; i <= labelsCount; i++) {
      labelTicks.push(Math.round((max / labelsCount) * i));
    }

    return { ticks, labelTicks };
  };

  const { ticks, labelTicks } = getScaleElements(targetMax);

  // Calculate coordinates for the background track arc (270 degrees)
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = ((startAngle + sweepAngle) * Math.PI) / 180;
  const trackStartX = cx + r * Math.cos(startRad);
  const trackStartY = cy + r * Math.sin(startRad);
  const trackEndX = cx + r * Math.cos(endRad);
  const trackEndY = cy + r * Math.sin(endRad);

  const trackD = `M ${trackStartX.toFixed(2)} ${trackStartY.toFixed(2)} A ${r} ${r} 0 1 1 ${trackEndX.toFixed(2)} ${trackEndY.toFixed(2)}`;

  // Calculate coordinates for the active speed arc
  const currentSweep = Math.min(1, displaySpeed / displayMax) * sweepAngle;
  const activeEndRad = ((startAngle + currentSweep) * Math.PI) / 180;
  const activeEndX = cx + r * Math.cos(activeEndRad);
  const activeEndY = cy + r * Math.sin(activeEndRad);
  const largeArcFlag = currentSweep > 180 ? 1 : 0;

  const activeD =
    displaySpeed > 0.1
      ? `M ${trackStartX.toFixed(2)} ${trackStartY.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${activeEndX.toFixed(2)} ${activeEndY.toFixed(2)}`
      : "";

  // Calculate coordinates for the inner subtle rim
  const innerR = 78;
  const innerStartX = cx + innerR * Math.cos(startRad);
  const innerStartY = cy + innerR * Math.sin(startRad);
  const innerEndX = cx + innerR * Math.cos(endRad);
  const innerEndY = cy + innerR * Math.sin(endRad);
  const innerD = `M ${innerStartX.toFixed(2)} ${innerStartY.toFixed(2)} A ${innerR} ${innerR} 0 1 1 ${innerEndX.toFixed(2)} ${innerEndY.toFixed(2)}`;

  const needleAngle = -135 + Math.min(1, displaySpeed / displayMax) * sweepAngle;

  const getTickCoords = (value: number, tickRadius: number) => {
    const tickAngle = -135 + (value / displayMax) * sweepAngle;
    const angleRad = ((tickAngle - 90) * Math.PI) / 180;
    return {
      x: cx + tickRadius * Math.cos(angleRad),
      y: cy + tickRadius * Math.sin(angleRad),
    };
  };

  const getElementOpacity = (value: number) => {
    if (value <= displayMax) return 1;
    // Fade in gracefully as it enters the scale
    const diff = value - displayMax;
    const threshold = targetMax * 0.15; // 15% of scale for fade transition
    return Math.max(0, 1 - diff / threshold);
  };

  const rippleR1 = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 76],
  });

  const rippleO1 = rippleAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.55, 0.25, 0],
  });

  const rippleR2 = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 48],
  });

  const rippleO2 = rippleAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.35, 0.15, 0],
  });

  return (
    <View className="items-center justify-center relative my-4">
      <Svg width="240" height="240" viewBox="0 0 240 240">
        <Defs>
          <LinearGradient id="speedGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#0ea5e9" />
            <Stop offset="50%" stopColor="#818cf8" />
            <Stop offset="100%" stopColor="#ec4899" />
          </LinearGradient>
          <LinearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#1e293b" stopOpacity={0.8} />
            <Stop offset="100%" stopColor="#0f172a" stopOpacity={0.8} />
          </LinearGradient>
        </Defs>

        {/* Dynamic circular ripple wave particles */}
        {speed > 0.5 && (
          <>
            {/* Hyperspace Particles */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <AnimatedLine
                key={`hyper-${angle}`}
                x1="120"
                y1="120"
                x2="120"
                y2="10"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="10 120"
                strokeDashoffset={rippleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [120, -10],
                })}
                opacity={rippleO2}
                transform={`rotate(${angle} 120 120)`}
              />
            ))}
            <AnimatedCircle
              cx="120"
              cy="120"
              r={rippleR1}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              opacity={rippleO1}
            />
            <AnimatedCircle
              cx="120"
              cy="120"
              r={rippleR2}
              fill="none"
              stroke="#818cf8"
              strokeWidth="1"
              opacity={rippleO2}
            />
          </>
        )}

        {/* Outer Background Track Arc */}
        <Path d={trackD} stroke="url(#trackGrad)" strokeWidth="12" fill="none" strokeLinecap="round" />

        {/* Active Speed Arc */}
        {activeD !== "" && (
          <Path d={activeD} stroke="url(#speedGrad)" strokeWidth="12" fill="none" strokeLinecap="round" />
        )}

        {/* Inner subtle rim */}
        <Path d={innerD} stroke="#1e293b" strokeWidth="1" fill="none" />

        {/* Ticks */}
        {ticks.map((val) => {
          const startCoords = getTickCoords(val, 84);
          const endCoords = getTickCoords(val, 91);
          const isActive = displaySpeed >= val && displaySpeed > 0;
          return (
            <Line
              key={val}
              x1={startCoords.x.toString()}
              y1={startCoords.y.toString()}
              x2={endCoords.x.toString()}
              y2={endCoords.y.toString()}
              stroke={isActive ? "#38bdf8" : "#334155"}
              strokeWidth={isActive ? "2.5" : "1.5"}
              opacity={getElementOpacity(val)}
            />
          );
        })}

        {/* Label numbers inside the gauge */}
        {labelTicks.map((val) => {
          const coords = getTickCoords(val, 64);
          const isActive = displaySpeed >= val && displaySpeed > 0;
          return (
            <SvgText
              key={val}
              x={coords.x.toString()}
              y={(coords.y + 3.5).toString()} // small offset to vertically center text
              fill={isActive ? "#f8fafc" : "#475569"}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              opacity={getElementOpacity(val)}
            >
              {val}
            </SvgText>
          );
        })}

        {/* Needle pointer */}
        <Path
          d="M 116 120 L 120 32 L 124 120 Z"
          fill="#38bdf8"
          transform={`rotate(${needleAngle}, 120, 120)`}
          stroke="#0284c7"
          strokeWidth="0.5"
        />

        {/* Center Hub */}
        <Circle cx="120" cy="120" r="14" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
        <Circle cx="120" cy="120" r="4" fill="#38bdf8" />
      </Svg>

      {/* Speedometer text readout */}
      <View className="absolute bottom-8 items-center">
        <Text className="text-3xl font-black text-slate-50">{displaySpeed.toFixed(1)}</Text>
        <Text className="text-slate-500 font-bold text-[9px] uppercase tracking-widest mt-0.5">Mbps</Text>
        {/* Dynamic Scale Indicator Badge */}
        <View className="bg-slate-950/80 border border-slate-800/80 rounded-full px-2 py-0.5 mt-1.5">
          <Text className="text-slate-400 font-mono text-[7px] uppercase tracking-wider font-extrabold">
            Max {targetMax}M
          </Text>
        </View>
      </View>
    </View>
  );
};

const Sparkline = ({ data, color, max }: { data: number[]; color: string; max: number }) => {
  if (data.length < 2) return null;
  const width = 176;
  const height = 40;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (Math.min(val, max) / max) * height;
    return `${x},${y}`;
  });

  const pathData = `M ${points[0]} L ${points.slice(1).join(" L ")}`;
  const fillData = `${pathData} L ${width},${height} L 0,${height} Z`;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.4" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={fillData} fill="url(#fillGrad)" />
      <Path d={pathData} stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
};

const RadarChart = ({ down, up, ping, jitter }: { down: number; up: number; ping: number; jitter: number }) => {
  const normDown = Math.min(100, (down / 1000) * 100);
  const normUp = Math.min(100, (up / 1000) * 100);
  const normPing = Math.min(100, Math.max(0, 100 - (ping / 200) * 100));
  const normJitter = Math.min(100, Math.max(0, 100 - (jitter / 50) * 100));

  const center = 100;
  const radius = 65;

  const getPoint = (val: number, angleDeg: number) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    const r = (val / 100) * radius;
    return `${center + r * Math.cos(angleRad)},${center + r * Math.sin(angleRad)}`;
  };

  const p1 = getPoint(normDown, 0);
  const p2 = getPoint(normPing, 90);
  const p3 = getPoint(normUp, 180);
  const p4 = getPoint(normJitter, 270);

  const polyData = `M ${p1} L ${p2} L ${p3} L ${p4} Z`;

  return (
    <View className="items-center justify-center my-4">
      <Svg width="200" height="180" viewBox="0 0 200 180">
        {[20, 40, 60, 80, 100].map((r) => (
          <Circle key={r} cx={center} cy={center} r={(r / 100) * radius} stroke="#334155" strokeWidth="1" fill="none" />
        ))}
        <Line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="#334155" />
        <Line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="#334155" />

        <Path d={polyData} fill="rgba(14, 165, 233, 0.4)" stroke="#0ea5e9" strokeWidth="2" />

        <Circle cx={p1.split(",")[0]} cy={p1.split(",")[1]} r="4" fill="#0ea5e9" />
        <Circle cx={p2.split(",")[0]} cy={p2.split(",")[1]} r="4" fill="#2dd4bf" />
        <Circle cx={p3.split(",")[0]} cy={p3.split(",")[1]} r="4" fill="#818cf8" />
        <Circle cx={p4.split(",")[0]} cy={p4.split(",")[1]} r="4" fill="#34d399" />

        <SvgText x={center} y={center - radius - 10} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">Download</SvgText>
        <SvgText x={center + radius + 8} y={center + 3} fill="#94a3b8" fontSize="10" textAnchor="start" fontWeight="bold">Ping</SvgText>
        <SvgText x={center} y={center + radius + 15} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">Upload</SvgText>
        <SvgText x={center - radius - 8} y={center + 3} fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="bold">Jitter</SvgText>
      </Svg>
    </View>
  );
};

const SpeedHistoryChart = ({ data }: { data: any[] }) => {
  if (data.length === 0) {
    return (
      <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 items-center justify-center py-10 shadow-md">
        <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">No Speed History Yet</Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.download || 10, d.upload || 10)), 10);

  return (
    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
      <Text className="text-sm font-bold text-slate-200 mb-4">Throughput Trends (Last 10 Tests)</Text>

      <View className="flex-row items-end justify-between h-32 pt-2 px-2 relative border-b border-slate-800">
        {data.map((item, idx) => {
          const dlHeight = Math.min(100, Math.round(((item.download || 0) / maxVal) * 100));
          const ulHeight = Math.min(100, Math.round(((item.upload || 0) / maxVal) * 100));

          return (
            <View key={item.id || idx} className="items-center flex-1 mx-1.5" style={{ gap: 2 }}>
              <View className="flex-row items-end h-24 gap-1 w-full justify-center">
                <View style={{ height: `${dlHeight}%` }} className="w-2.5 bg-sky-500 rounded-t-sm" />
                <View style={{ height: `${ulHeight}%` }} className="w-2.5 bg-indigo-400 rounded-t-sm" />
              </View>
              <Text className="text-[8px] text-slate-500 font-bold mt-1">#{data.length - idx}</Text>
            </View>
          );
        })}
      </View>
      <View className="flex-row gap-4 mt-3 justify-center">
        <View className="flex-row items-center gap-1.5">
          <View className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
          <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Download</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2.5 h-2.5 rounded-sm bg-indigo-400" />
          <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Upload</Text>
        </View>
      </View>
    </View>
  );
};

type TestStatus = "idle" | "ping" | "download" | "upload" | "finished";

export default function SpeedScreen() {
  const { settings } = useAppStore();
  const [status, setStatus] = useState<TestStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [ping, setPing] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [downloadHistory, setDownloadHistory] = useState<number[]>([]);
  const [uploadHistory, setUploadHistory] = useState<number[]>([]);

  // Animation values for UI/UX enhancements
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Pulse animation loop during active test states
  React.useEffect(() => {
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

  // Fade-in animation for rating card on test finish
  React.useEffect(() => {
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

  // Haptic feedback for status changes
  React.useEffect(() => {
    if (status === "ping" || status === "download" || status === "upload") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (status === "finished") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [status]);

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
    React.useCallback(() => {
      fetchSpeedHistory();
    }, [fetchSpeedHistory])
  );

  const DOWNLOAD_URL =
    settings.customDownloadUrl.trim() !== ""
      ? settings.customDownloadUrl.trim()
      : "https://speed.cloudflare.com/__down?bytes=250000000";
  const UPLOAD_URL =
    settings.customUploadUrl.trim() !== "" ? settings.customUploadUrl.trim() : "https://speed.cloudflare.com/__up";

  const downloadSpeedRef = React.useRef(downloadSpeed);
  const pingRef = React.useRef(ping);

  // Keep refs updated with current state values
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

        // Safely access cellular details on native platforms
        if (Platform.OS !== "web") {
          try {
            const cell = getCellularDetails();
            cellCarrier = cell?.carrier ?? "WiFi Link";
            connType = cell?.networkType ?? "WiFi";
          } catch {
            // ignore
          }
        }

        const finalPing = pingRef.current;
        // Save speed test to local database
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

  const saveTestResultRef = React.useRef(saveTestResult);
  useEffect(() => {
    saveTestResultRef.current = saveTestResult;
  }, [saveTestResult]);

  useEffect(() => {
    // Register native or fallback JS event listeners
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

        // Capture average speeds and save to database
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
      // Cancel active test
      stopSpeedTest();
      setStatus("idle");
      setProgress(0);
      return;
    }

    // Reset values
    setPing(null);
    setJitter(null);
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setDownloadHistory([]);
    setUploadHistory([]);
    setProgress(0);
    setStatus("ping");

    const success = startSpeedTest(DOWNLOAD_URL, UPLOAD_URL);
    if (!success) {
      Alert.alert("Error", "Could not initiate native speed test routine.");
      setStatus("idle");
    }
  };

  // Determine pointer speed values for UI gauge. Reset to 0 when finished so the needle drops back down cleanly.
  const currentSpeed = status === "download" ? downloadSpeed : status === "upload" ? uploadSpeed : 0;

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#020617" }} className="flex-1 bg-slate-950">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
        className="flex-1 px-4 py-2"
      >
        {/* Title */}
        <View className="mb-6 mt-4">
          <Text className="text-2xl font-bold text-slate-50">Speed Test</Text>
          <Text className="text-slate-400 text-xs mt-0.5">Multi-threaded latency and throughput audit</Text>
        </View>

        {/* Gauge Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 items-center py-8 shadow-lg relative overflow-hidden">
          {/* Animated Glow during active testing */}
          {(status === "download" || status === "upload") && (
            <View
              className={`absolute top-10 w-44 h-44 rounded-full filter blur-3xl opacity-15 ${status === "download" ? "bg-sky-500" : "bg-indigo-500"}`}
            />
          )}

          {/* Core Speedometer Gauge */}
          <Speedometer speed={currentSpeed} />

          {status !== "idle" && status !== "finished" && (
            <View className="w-44 h-10 mt-3 items-center justify-center">
              {status === "download" && downloadHistory.length > 0 ? (
                <Sparkline data={downloadHistory} color="#0ea5e9" max={currentSpeed > 450 ? 1000 : currentSpeed > 180 ? 500 : currentSpeed > 90 ? 200 : 100} />
              ) : status === "upload" && uploadHistory.length > 0 ? (
                <Sparkline data={uploadHistory} color="#818cf8" max={currentSpeed > 450 ? 1000 : currentSpeed > 180 ? 500 : currentSpeed > 90 ? 200 : 100} />
              ) : (
                <View className="w-full bg-slate-950 border border-slate-800 h-2.5 rounded-full overflow-hidden shadow-inner">
                  <View
                    style={{ width: `${progress * 100}%` }}
                    className={`h-full ${status === "download" ? "bg-sky-500" : "bg-indigo-400"}`}
                  />
                </View>
              )}
            </View>
          )}

          {status !== "idle" && (
            <Text className="text-[10px] font-black text-sky-400 uppercase tracking-widest mt-2">
              {status.toUpperCase()}
            </Text>
          )}

          {/* Action Trigger Button */}
          <TouchableOpacity
            onPress={handleStartTest}
            className={`mt-6 px-12 py-3.5 rounded-full shadow-lg items-center justify-center ${
              status !== "idle" && status !== "finished"
                ? "bg-slate-800 border border-slate-700 active:bg-slate-700"
                : "bg-sky-500 active:bg-sky-600"
            }`}
          >
            <Text className="text-white font-extrabold text-sm uppercase tracking-wider">
              {status !== "idle" && status !== "finished" ? "Cancel Test" : "Start Test"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Speed test metrics details grid */}
        <View className="flex-row flex-wrap gap-4 mb-6">
          {/* Download Speed Card */}
          <Animated.View
            style={{
              borderColor:
                status === "download" ? "#0ea5e9" : status === "finished" ? "rgba(14, 165, 233, 0.4)" : "#1e293b",
              opacity: status === "download" ? pulseAnim : 1.0,
              borderWidth: 1,
            }}
            className="flex-1 min-w-[45%] bg-slate-900 rounded-2xl p-4 shadow-md flex-row items-center gap-3"
          >
            <View className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <ArrowDown size={20} color="#0ea5e9" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Download</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {downloadSpeed > 0 ? `${downloadSpeed.toFixed(1)}` : "—"}
                {downloadSpeed > 0 && <Text className="text-xs font-semibold text-slate-400"> Mbps</Text>}
              </Text>
            </View>
          </Animated.View>

          {/* Upload Speed Card */}
          <Animated.View
            style={{
              borderColor:
                status === "upload" ? "#818cf8" : status === "finished" ? "rgba(129, 140, 248, 0.4)" : "#1e293b",
              opacity: status === "upload" ? pulseAnim : 1.0,
              borderWidth: 1,
            }}
            className="flex-1 min-w-[45%] bg-slate-900 rounded-2xl p-4 shadow-md flex-row items-center gap-3"
          >
            <View className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <ArrowUp size={20} color="#818cf8" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Upload</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {uploadSpeed > 0 ? `${uploadSpeed.toFixed(1)}` : "—"}
                {uploadSpeed > 0 && <Text className="text-xs font-semibold text-slate-400"> Mbps</Text>}
              </Text>
            </View>
          </Animated.View>

          {/* Latency Ping Card */}
          <Animated.View
            style={{
              borderColor:
                status === "ping" ? "#2dd4bf" : status === "finished" ? "rgba(45, 212, 191, 0.4)" : "#1e293b",
              opacity: status === "ping" ? pulseAnim : 1.0,
              borderWidth: 1,
            }}
            className="flex-1 min-w-[45%] bg-slate-900 rounded-2xl p-4 shadow-md flex-row items-center gap-3"
          >
            <View className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20">
              <Clock size={20} color="#2dd4bf" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Ping (Latency)</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {ping !== null ? `${ping.toFixed(0)}` : "—"}
                {ping !== null && <Text className="text-xs font-semibold text-slate-400"> ms</Text>}
              </Text>
            </View>
          </Animated.View>

          {/* Jitter Card */}
          <Animated.View
            style={{
              borderColor:
                status === "ping" ? "#34d399" : status === "finished" ? "rgba(52, 211, 153, 0.4)" : "#1e293b",
              opacity: status === "ping" ? pulseAnim : 1.0,
              borderWidth: 1,
            }}
            className="flex-1 min-w-[45%] bg-slate-900 rounded-2xl p-4 shadow-md flex-row items-center gap-3"
          >
            <View className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Zap size={20} color="#34d399" />
            </View>
            <View>
              <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Jitter</Text>
              <Text className="text-lg font-black text-slate-100 mt-0.5">
                {jitter !== null ? `${jitter.toFixed(1)}` : "—"}
                {jitter !== null && <Text className="text-xs font-semibold text-slate-400"> ms</Text>}
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Audit Completion rating summary Card */}
        {status === "finished" && (
          <Animated.View
            style={{ opacity: fadeAnim }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden"
          >
            {/* Background rating highlight glow */}
            <View
              className={`absolute -right-10 -top-10 w-24 h-24 rounded-full filter blur-xl opacity-20 ${
                downloadSpeed > 100 ? "bg-emerald-500" : downloadSpeed > 50 ? "bg-sky-500" : "bg-indigo-500"
              }`}
            />

            <View className="flex-row items-center gap-2 mb-2">
              <View className="p-1 rounded bg-slate-950 border border-slate-800">
                <Text className="text-[10px]">🏆</Text>
              </View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Rating</Text>
            </View>
            
            <RadarChart down={downloadSpeed} up={uploadSpeed} ping={ping ?? 0} jitter={jitter ?? 0} />
            
            <Text
              className={`text-sm font-black mt-1 ${
                downloadSpeed > 100
                  ? "text-emerald-400"
                  : downloadSpeed > 50
                    ? "text-sky-400"
                    : downloadSpeed > 15
                      ? "text-indigo-400"
                      : "text-amber-500"
              }`}
            >
              {downloadSpeed > 100
                ? "Excellent Connection"
                : downloadSpeed > 50
                  ? "Good Connection"
                  : downloadSpeed > 15
                    ? "Standard Connection"
                    : "Poor Connection"}
            </Text>
            <Text className="text-[10px] text-slate-400 mt-2 leading-4 font-semibold">
              {downloadSpeed > 100
                ? "Your network delivers ultra-fast download bandwidth and low latency. Ideal for intensive tasks like 4K/8K streaming, competitive gaming, and bulk file sharing."
                : downloadSpeed > 50
                  ? "Your network is fast and stable. Great for multiple HD video streams, clear video calls, and standard cloud backups."
                  : downloadSpeed > 15
                    ? "Your network provides basic broadband speeds. Suitable for daily web browsing, emails, and single-device streaming."
                    : "Your network speed is currently constrained. You might experience buffering during high-definition video playback or multi-party video calls."}
            </Text>
          </Animated.View>
        )}

        {/* Speed Test History Chart */}
        <SpeedHistoryChart data={history} />

        {/* Speed Test History List */}
        {history.length > 0 && (
          <View style={{ gap: 10 }} className="mt-2">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1">
              Detailed Logs History
            </Text>
            {history
              .slice()
              .reverse()
              .map((item, idx) => {
                const timeString =
                  new Date(item.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) +
                  " " +
                  new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <View
                    key={item.id || idx}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-row items-center justify-between shadow-md"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-slate-200 font-bold text-xs">{item.carrier || "WiFi Link"}</Text>
                      <Text className="text-slate-500 text-[10px] font-semibold mt-0.5">
                        {item.networkType} • {timeString}
                      </Text>
                    </View>

                    <View className="flex-row gap-4 items-center">
                      <View className="items-end">
                        <View className="flex-row items-center gap-1">
                          <ArrowDown size={11} color="#0ea5e9" />
                          <Text className="text-slate-200 font-black text-xs font-mono">
                            {item.download?.toFixed(1)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <ArrowUp size={11} color="#818cf8" />
                          <Text className="text-slate-400 font-semibold text-[10px] font-mono">
                            {item.upload?.toFixed(1)}
                          </Text>
                        </View>
                      </View>

                      {item.ping != null && (
                        <View className="border-l border-slate-800/80 pl-3 items-center justify-center min-w-[40px]">
                          <Text className="text-teal-400 font-black text-xs font-mono">{Math.round(item.ping)}</Text>
                          <Text className="text-slate-500 text-[7px] uppercase font-bold tracking-wider">Ping</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
