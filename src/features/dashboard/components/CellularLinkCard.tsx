import React from "react";
import { View, Text, Animated, TouchableOpacity } from "react-native";
import { Radio, Zap, Activity, Globe, AlertTriangle } from "lucide-react-native";
import { CellularDiagnosticsData } from "../../../../modules/cellular-diagnostics";

interface CellularLinkCardProps {
  cellDetails: CellularDiagnosticsData[] | null;
  selectedSimIndex: number;
  setSelectedSimIndex: (index: number) => void;
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

export function CellularLinkCard({
  cellDetails,
  selectedSimIndex,
  setSelectedSimIndex,
  overallHealth,
  fadeAnim,
  slideAnim,
}: CellularLinkCardProps) {
  if (!cellDetails || cellDetails.length === 0) return null;

  const getSignalQuality = (rsrp: number | null) => {
    if (rsrp === null || rsrp === 0 || rsrp === 2147483647)
      return { label: "No Signal", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/20" };
    if (rsrp >= -85)
      return {
        label: "Excellent",
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
      };
    if (rsrp >= -100)
      return { label: "Good", color: "text-teal-400", bg: "bg-teal-500/15", border: "border-teal-500/30" };
    if (rsrp >= -115)
      return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" };
    return { label: "Poor", color: "text-rose-400", bg: "bg-rose-500/15", border: "border-rose-500/30" };
  };

  const getLteIdentifiers = (cid: number | null) => {
    if (!cid || cid === 2147483647) return { enodeb: "—", sector: "—" };
    return { enodeb: Math.floor(cid / 256).toString(), sector: (cid % 256).toString() };
  };

  const sim = cellDetails[selectedSimIndex] || cellDetails[0];
  const simSignal = getSignalQuality(sim.rsrp);
  const actualIndex = cellDetails[selectedSimIndex] ? selectedSimIndex : 0;
  const { enodeb, sector } = getLteIdentifiers(sim.cid ?? null);

  return (
    <View>
      {cellDetails.length > 1 && (
        <View className="flex-row gap-3 mb-4">
          {cellDetails.map((simData, index) => {
            const isSelected = selectedSimIndex === index;
            return (
              <TouchableOpacity
                key={`sim-${index}`}
                onPress={() => setSelectedSimIndex(index)}
                className={`will-change-variable flex-1 py-3 rounded-2xl items-center border ${
                  isSelected ? "bg-slate-800 border-sky-500/50 shadow-md" : "bg-slate-900 border-slate-800/80"
                }`}
              >
                <Text
                  className={`text-xs font-black uppercase tracking-wider ${isSelected ? "text-sky-400" : "text-slate-500"}`}
                >
                  {simData.carrier || `SIM ${index + 1}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Animated.View
        style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}
        className="bg-slate-900 border border-slate-800 rounded-3xl mb-5 shadow-lg relative overflow-hidden"
      >
        <View
          className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-20 ${sim.rsrp ? (sim.rsrp >= -90 ? "bg-emerald-500" : "bg-amber-500") : "bg-slate-500"}`}
        />

        <View className="p-5">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Radio size={20} color="#0ea5e9" />
              <Text className="text-lg font-bold text-slate-100">
                {sim.carrier
                  ? `${sim.carrier} ${sim.networkType !== "Unknown" && sim.networkType ? sim.networkType : "Network"}`
                  : `SIM ${actualIndex + 1} Network`}
              </Text>
            </View>
            <View className={`${simSignal.bg} ${simSignal.border} border px-3 py-1 rounded-full`}>
              <Text className={`text-xs font-bold ${simSignal.color}`}>{simSignal.label}</Text>
            </View>
          </View>

          <View className="flex-row items-baseline mb-4">
            <Text className="text-5xl font-black text-slate-50">{sim.rsrp ?? "—"}</Text>
            {sim.rsrp !== null && (
              <Text className="text-slate-400 font-semibold text-sm ml-1.5">dBm (RSRP)</Text>
            )}
          </View>

          <View className="grid grid-cols-2 gap-4 flex-row flex-wrap border-t border-slate-800/80 pt-4">
            <View className="w-[47%]">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Carrier</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.carrier || "Unknown"}</Text>
            </View>
            <View className="w-[47%]">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Network Type</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.networkType || "None"}</Text>
            </View>
            <View className="w-[47%]">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Active Band</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">{sim.band ? `Band ${sim.band}` : "—"}</Text>
            </View>
            <View className="w-[47%]">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">SINR</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">
                {sim.sinr != null && sim.sinr !== 2147483647 ? `${sim.sinr} dB` : "—"}
              </Text>
            </View>
            <View className="w-[47%] mt-2">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">RSRQ</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">
                {sim.rsrq != null && sim.rsrq !== 2147483647 ? `${sim.rsrq} dB` : "—"}
              </Text>
            </View>
            <View className="w-[47%] mt-2">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">RSSI</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">
                {sim.rssi != null && sim.rssi !== 2147483647 ? `${sim.rssi} dBm` : "—"}
              </Text>
            </View>
            <View className="w-[47%] mt-2">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">eNodeB ID</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">{enodeb}</Text>
            </View>
            <View className="w-[47%] mt-2">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Sector</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">{sector}</Text>
            </View>
            <View className="w-[47%] mt-2">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">PCI</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">
                {sim.pci != null && sim.pci !== 2147483647 ? sim.pci : "—"}
              </Text>
            </View>
            <View className="w-[47%] mt-2">
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">TAC</Text>
              <Text className="text-slate-200 font-bold text-sm mt-0.5">
                {sim.tac != null && sim.tac !== 2147483647 ? sim.tac : "—"}
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
    </View>
  );
}
