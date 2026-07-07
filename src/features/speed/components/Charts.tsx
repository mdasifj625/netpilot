import React from "react";
import { View, Text } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";

export const Sparkline = ({ data, color, max }: { data: number[]; color: string; max: number }) => {
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

export const RadarChart = ({ down, up, ping, jitter }: { down: number; up: number; ping: number; jitter: number }) => {
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

        <SvgText x={center} y={center - radius - 10} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">
          Download
        </SvgText>
        <SvgText
          x={center + radius + 8}
          y={center + 3}
          fill="#94a3b8"
          fontSize="10"
          textAnchor="start"
          fontWeight="bold"
        >
          Ping
        </SvgText>
        <SvgText x={center} y={center + radius + 15} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">
          Upload
        </SvgText>
        <SvgText x={center - radius - 8} y={center + 3} fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="bold">
          Jitter
        </SvgText>
      </Svg>
    </View>
  );
};

export const SpeedHistoryChart = ({ data }: { data: any[] }) => {
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
                <View style={{ height: `${ulHeight}%` }} className="w-2.5 bg-pink-500 rounded-t-sm" />
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
          <View className="w-2.5 h-2.5 rounded-sm bg-pink-500" />
          <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Upload</Text>
        </View>
      </View>
    </View>
  );
};
