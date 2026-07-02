import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { desc } from "drizzle-orm";
import { 
  Sliders, 
  Bell, 
  HelpCircle, 
  History, 
  Trash2, 
  Signal,
  CheckCircle,
  AlertCircle
} from "lucide-react-native";

// Import modules, stores, and DB
import { startBackgroundService, stopBackgroundService } from "../../../modules/cellular-diagnostics";
import { useAppStore } from "../../store/useAppStore";
import { db } from "../../database/db";
import { networkHistory, NetworkHistorySelect } from "../../database/schema";

export default function SettingsScreen() {
  const { settings, updateSettings } = useAppStore();
  const [logs, setLogs] = useState<NetworkHistorySelect[]>([]);

  const fetchLogs = async () => {
    try {
      const history = await db
        .select()
        .from(networkHistory)
        .orderBy(desc(networkHistory.timestamp))
        .limit(10);
      setLogs(history);
    } catch (e) {
      console.error("Failed to query log history:", e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchLogs();
    }, [])
  );

  const handleToggleTracking = (value: boolean) => {
    try {
      if (value) {
        const success = startBackgroundService();
        if (success) {
          updateSettings({ backgroundTrackingEnabled: true });
        } else {
          Alert.alert("Error", "Could not start native background service.");
        }
      } else {
        const success = stopBackgroundService();
        if (success) {
          updateSettings({ backgroundTrackingEnabled: false });
        } else {
          Alert.alert("Error", "Could not stop native background service.");
        }
      }
    } catch (e) {
      console.error("Failed to toggle service status:", e);
    }
  };

  const handleClearLogs = async () => {
    Alert.alert(
      "Confirm Action",
      "Are you sure you want to delete all logged network history?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive",
          onPress: async () => {
            try {
              await db.delete(networkHistory);
              fetchLogs();
              Alert.alert("Cleared", "All network logs have been deleted.");
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-4 py-2">
        {/* Title */}
        <View className="mb-6 mt-4">
          <Text className="text-2xl font-bold text-slate-50">Settings</Text>
          <Text className="text-slate-400 text-xs mt-0.5">Control background telemetry and data logging</Text>
        </View>

        {/* Telemetry Control Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row items-center gap-2 mb-4">
            <Sliders size={18} color="#0ea5e9" />
            <Text className="text-sm font-bold text-slate-200">Telemetry Engine</Text>
          </View>

          <View className="flex-row justify-between items-center py-2.5">
            <View className="flex-1 pr-4">
              <Text className="text-slate-200 font-semibold text-sm">Background Logging</Text>
              <Text className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                Persist cellular signal and location shifts to SQLite using a native Foreground Service.
              </Text>
            </View>
            <Switch
              value={settings.backgroundTrackingEnabled}
              onValueChange={handleToggleTracking}
              trackColor={{ false: "#1e293b", true: "#0ea5e9" }}
              thumbColor={settings.backgroundTrackingEnabled ? "#f8fafc" : "#64748b"}
            />
          </View>
        </View>

        {/* SQLite Logs History Viewer */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-5 shadow-lg">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2.5">
              <History size={18} color="#818cf8" />
              <Text className="text-sm font-bold text-slate-200">Recent SQLite Logs</Text>
            </View>
            {logs.length > 0 && (
              <TouchableOpacity onPress={handleClearLogs} className="p-1">
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>

          {logs.length > 0 ? (
            <View style={{ gap: 8 }}>
              {logs.map((log) => {
                const date = new Date(log.timestamp).toLocaleTimeString();
                return (
                  <View key={log.id} className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-3 flex-row justify-between items-center">
                    <View>
                      <Text className="text-slate-200 font-bold text-xs">{log.carrier || "WiFi"}</Text>
                      <Text className="text-slate-500 text-[9px] font-medium mt-0.5">{date} • {log.networkType}</Text>
                    </View>
                    <View className="items-end">
                      {log.signal !== null ? (
                        <Text className={`font-extrabold text-xs ${log.signal >= -90 ? "text-emerald-400" : log.signal >= -105 ? "text-amber-400" : "text-rose-400"}`}>
                          {log.signal} dBm
                        </Text>
                      ) : (
                        <Text className="text-slate-400 font-bold text-xs">
                          {log.download ? `${log.download.toFixed(1)}M / ${log.upload?.toFixed(1)}M` : "—"}
                        </Text>
                      )}
                      <Text className="text-slate-500 text-[9px] font-semibold mt-0.5">
                        {log.signal !== null ? "RSRP" : "Speed"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="bg-slate-950/40 border border-slate-800/40 rounded-2xl p-6 items-center justify-center">
              <AlertCircle size={24} color="#64748b" className="mb-2" />
              <Text className="text-slate-400 text-xs text-center">No logs recorded yet.</Text>
              <Text className="text-slate-500 text-[9px] text-center mt-1 max-w-[200px]">
                Toggle Background Logging and move around to collect telemetry points.
              </Text>
            </View>
          )}
        </View>

        {/* Automation Rules */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-lg" style={{ gap: 16 }}>
          <View className="flex-row items-center gap-3">
            <Bell size={18} color="#2dd4bf" />
            <View className="flex-1">
              <Text className="text-slate-200 font-bold text-sm">Rules Automation</Text>
              <Text className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                Rules Builder is loaded locally. Rules are parsed on background startup.
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3 border-t border-slate-800/50 pt-4">
            <HelpCircle size={18} color="#64748b" />
            <View className="flex-1">
              <Text className="text-slate-200 font-semibold text-xs">About NetPilot</Text>
              <Text className="text-slate-500 text-[9px] mt-0.5">Version 1.0.0 (Local-First Development)</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
