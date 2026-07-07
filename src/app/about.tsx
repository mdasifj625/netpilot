import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Info, Shield, Zap } from "lucide-react-native";
import pkg from "../../package.json";

export default function AboutScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#020617" }} className="flex-1">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        
        {/* Header Logo Area */}
        <View className="items-center justify-center my-8">
          <View className="w-24 h-24 bg-slate-900 rounded-3xl border border-slate-800 items-center justify-center mb-6 shadow-2xl">
            <Zap size={48} color="#0ea5e9" />
          </View>
          <Text className="text-3xl font-black text-slate-50 tracking-tight">NetPilot</Text>
          <Text className="text-sky-400 font-bold text-sm tracking-widest uppercase mt-2">
            Advanced Network Diagnostics
          </Text>
        </View>

        {/* Info Cards */}
        <View className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 mb-4">
          <View className="flex-row items-center gap-3 mb-3">
            <Info size={20} color="#94a3b8" />
            <Text className="text-slate-200 font-bold text-base">App Information</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-slate-800/60">
            <Text className="text-slate-400">Version</Text>
            <Text className="text-slate-100 font-bold">{pkg.version}</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-slate-800/60">
            <Text className="text-slate-400">Build Engine</Text>
            <Text className="text-slate-100 font-bold">Expo SDK 57</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-slate-800/60">
            <Text className="text-slate-400">Telemetry Engine</Text>
            <Text className="text-slate-100 font-bold">Native Kotlin</Text>
          </View>
          <View className="flex-row justify-between py-3">
            <Text className="text-slate-400">Architecture</Text>
            <Text className="text-slate-100 font-bold">Hermes + NativeWind</Text>
          </View>
        </View>

        <View className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 mb-6">
          <View className="flex-row items-center gap-3 mb-2">
            <Shield size={20} color="#94a3b8" />
            <Text className="text-slate-200 font-bold text-base">Privacy & Analytics</Text>
          </View>
          <Text className="text-slate-400 text-sm leading-relaxed mt-2">
            NetPilot performs zero background telemetry or remote analytics. All hardware 
            metrics, cell tower signals, and speed tests are executed directly on-device 
            using local Kotlin modules. Your data never leaves your device unless explicitly shared.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}
