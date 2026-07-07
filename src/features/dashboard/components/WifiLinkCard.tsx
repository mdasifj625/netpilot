import React from "react";
import { View, Text, Animated } from "react-native";
import { Wifi, Zap, Activity, Globe, AlertTriangle } from "lucide-react-native";
import { ConnectedWifiInfo } from "../../../../modules/wifi-analyzer";

interface WifiLinkCardProps {
  wifiDetails: ConnectedWifiInfo | null;
  overallHealth: {
    label: string;
    desc: string;
    color: string;
    border: string;
    bg: string;
    glow: string;
    icon: string;
  };
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
}

export function WifiLinkCard({ wifiDetails, overallHealth, fadeAnim, slideAnim }: WifiLinkCardProps) {
  if (!wifiDetails || wifiDetails.ssid == null) return null;

  const getWifiSignalQuality = (level: number | null) => {
    if (level === null)
      return { label: "No Signal", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (level >= -55)
      return {
        label: "Excellent",
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
      };
    if (level >= -70)
      return { label: "Good", color: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/30" };
    if (level >= -85)
      return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" };
    return { label: "Poor", color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/30" };
  };

  const wifiSignalQuality = getWifiSignalQuality(wifiDetails.level ?? null);

  return (
    <Animated.View
      style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}
      className="bg-slate-900 border border-slate-800 rounded-3xl mb-5 shadow-lg relative overflow-hidden"
    >
      <View
        className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-20 ${wifiDetails.level && wifiDetails.level >= -70 ? "bg-emerald-500" : "bg-amber-500"}`}
      />

      <View className="p-5">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center gap-2">
            <Wifi size={20} color="#0ea5e9" />
            <Text className="text-lg font-bold text-slate-100">Wi-Fi Link</Text>
          </View>
          <View className={`${wifiSignalQuality.bg} ${wifiSignalQuality.border} border px-3 py-1 rounded-full`}>
            <Text className={`text-xs font-bold ${wifiSignalQuality.color}`}>{wifiSignalQuality.label}</Text>
          </View>
        </View>
        <View className="flex-row items-baseline mb-4">
          <Text className="text-5xl font-black text-slate-50">{wifiDetails.level ?? "—"}</Text>
          {wifiDetails.level !== null && (
            <Text className="text-slate-400 font-semibold text-sm ml-1.5">dBm (RSSI)</Text>
          )}
        </View>
        <View className="grid grid-cols-2 gap-4 flex-row flex-wrap border-t border-slate-800/80 pt-4">
          <View className="w-[47%]">
            <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">SSID</Text>
            <Text className="text-slate-200 font-bold text-sm mt-0.5" numberOfLines={1}>
              {wifiDetails.ssid}
            </Text>
          </View>
          <View className="w-[47%]">
            <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Link Speed</Text>
            <Text className="text-slate-200 font-bold text-sm mt-0.5">
              {wifiDetails.linkSpeed ? `${wifiDetails.linkSpeed} Mbps` : "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Merged Overall Health Banner */}
      <View className={`p-4 border-t border-slate-800/80 ${overallHealth.bg} flex-row items-center gap-3.5`}>
        <View className={`p-2 rounded-xl ${overallHealth.bg} border border-slate-800/50`}>
          {overallHealth.icon === "gaming" ? (
            <Zap size={18} color="#10b981" />
          ) : overallHealth.icon === "streaming" ? (
            <Activity size={18} color="#0ea5e9" />
          ) : overallHealth.icon === "basic" ? (
            <Globe size={18} color="#f59e0b" />
          ) : overallHealth.icon === "alert" ? (
            <AlertTriangle size={18} color="#ef4444" />
          ) : (
            <Activity size={18} color="#94a3b8" />
          )}
        </View>
        <View className="flex-1">
          <Text className={`text-[10px] font-black uppercase tracking-widest ${overallHealth.color}`}>
            {overallHealth.label}
          </Text>
          <Text
            className={`text-[10px] font-semibold mt-0.5 ${overallHealth.icon === "alert" ? "text-rose-300" : "text-slate-400"}`}
          >
            {overallHealth.desc}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
