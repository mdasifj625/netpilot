import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { desc, eq } from "drizzle-orm";
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
import { startBackgroundService, stopBackgroundService, setPowerSaverEnabled } from "../../../modules/cellular-diagnostics";
import { useAppStore } from "../../store/useAppStore";
import { db } from "../../database/db";
import { networkHistory, NetworkHistorySelect, automationRules, AutomationRuleSelect } from "../../database/schema";

export default function SettingsScreen() {
  const { settings, updateSettings } = useAppStore();
  const [logs, setLogs] = useState<NetworkHistorySelect[]>([]);
  const [rules, setRules] = useState<AutomationRuleSelect[]>([]);

  // Rule Form States
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [triggerType, setTriggerType] = useState<"signal" | "speed">("signal");
  const [operator, setOperator] = useState<"lt" | "gt">("lt");
  const [value, setValue] = useState("");
  const [actionType, setActionType] = useState<"notification" | "log">("notification");

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

  const fetchRules = async () => {
    try {
      const activeRules = await db
        .select()
        .from(automationRules);
      setRules(activeRules);
    } catch (e) {
      console.error("Failed to query automation rules:", e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchLogs();
      fetchRules();
    }, [])
  );

  const handleToggleTracking = (val: boolean) => {
    try {
      if (val) {
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

  const handleTogglePowerSaver = (val: boolean) => {
    try {
      const success = setPowerSaverEnabled(val);
      if (success) {
        updateSettings({ powerSaverEnabled: val });
      } else {
        Alert.alert("Error", "Could not sync power saver state with native module.");
      }
    } catch (e) {
      console.error("Failed to toggle power saver:", e);
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

  const handleAddRule = async () => {
    if (!ruleName.trim() || !value.trim()) {
      Alert.alert("Missing Fields", "Please specify a name and numeric threshold value.");
      return;
    }
    const numericVal = parseFloat(value);
    if (isNaN(numericVal)) {
      Alert.alert("Invalid Input", "Threshold value must be a valid number.");
      return;
    }

    try {
      await db.insert(automationRules).values({
        name: ruleName.trim(),
        triggerType,
        operator,
        value: String(numericVal),
        actionType,
        isActive: true
      });
      
      // Refresh list & reset form
      fetchRules();
      setRuleName("");
      setValue("");
      setShowRuleForm(false);
      Alert.alert("Success", `Automation rule '${ruleName}' saved successfully.`);
    } catch (e) {
      console.error("Failed to save rules:", e);
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await db.delete(automationRules).where(eq(automationRules.id, id));
      fetchRules();
    } catch (e) {
      console.error("Failed to delete rule:", e);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-4 py-2" contentContainerStyle={{ paddingBottom: 24, gap: 16 }}>
        {/* Title */}
        <View className="mb-2 mt-4">
          <Text className="text-2xl font-bold text-slate-50">Settings</Text>
          <Text className="text-slate-400 text-xs mt-0.5">Control background telemetry and data logging</Text>
        </View>

        {/* Telemetry Control Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
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

          <View className="flex-row justify-between items-center py-2.5 border-t border-slate-800/40 mt-2">
            <View className="flex-1 pr-4">
              <Text className="text-slate-200 font-semibold text-sm">Power Saver Mode</Text>
              <Text className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                Relaxes scanning rate from 10s to 60s and pauses background location tracking when device is stationary.
              </Text>
            </View>
            <Switch
              value={settings.powerSaverEnabled}
              onValueChange={handleTogglePowerSaver}
              trackColor={{ false: "#1e293b", true: "#0ea5e9" }}
              thumbColor={settings.powerSaverEnabled ? "#f8fafc" : "#64748b"}
            />
          </View>
        </View>

        {/* SQLite Logs History Viewer */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
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

        {/* Automation Rules Section */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-lg" style={{ gap: 16 }}>
          <View className="flex-row justify-between items-center border-b border-slate-800/50 pb-3">
            <View className="flex-row items-center gap-2.5">
              <Bell size={18} color="#2dd4bf" />
              <Text className="text-sm font-bold text-slate-200">Rules Automation</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowRuleForm(!showRuleForm)}
              className="bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-xl active:bg-teal-500/20"
            >
              <Text className="text-teal-400 font-extrabold text-[10px] uppercase tracking-wider">
                {showRuleForm ? "Cancel" : "Add Rule"}
              </Text>
            </TouchableOpacity>
          </View>

          {showRuleForm && (
            <View className="bg-slate-950/40 rounded-2xl border border-slate-800/60 p-4" style={{ gap: 12 }}>
              <View>
                <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Rule Name</Text>
                <TextInput
                  value={ruleName}
                  onChangeText={setRuleName}
                  placeholder="e.g. Low Signal Warning"
                  placeholderTextColor="#64748b"
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs"
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Trigger</Text>
                  <View className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-2 justify-center">
                    <Text className="text-slate-300 text-xs">Cell Signal (RSRP)</Text>
                  </View>
                </View>

                <View className="flex-1">
                  <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Operator</Text>
                  <View className="flex-row bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                    <TouchableOpacity 
                      onPress={() => setOperator("lt")}
                      className={`flex-1 py-1 rounded justify-center items-center ${operator === "lt" ? "bg-teal-500" : "bg-transparent"}`}
                    >
                      <Text className={`font-bold text-xs ${operator === "lt" ? "text-slate-950" : "text-slate-400"}`}>&lt;</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setOperator("gt")}
                      className={`flex-1 py-1 rounded justify-center items-center ${operator === "gt" ? "bg-teal-500" : "bg-transparent"}`}
                    >
                      <Text className={`font-bold text-xs ${operator === "gt" ? "text-slate-950" : "text-slate-400"}`}>&gt;</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Threshold Value (dBm)</Text>
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  keyboardType="numeric"
                  placeholder="e.g. -110"
                  placeholderTextColor="#64748b"
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs font-mono"
                />
              </View>

              <View>
                <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Action Type</Text>
                <View className="flex-row bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                  <TouchableOpacity 
                    onPress={() => setActionType("notification")}
                    className={`flex-1 py-1.5 rounded justify-center items-center ${actionType === "notification" ? "bg-teal-500" : "bg-transparent"}`}
                  >
                    <Text className={`font-bold text-[9px] uppercase tracking-wider ${actionType === "notification" ? "text-slate-950" : "text-slate-400"}`}>Notify</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setActionType("log")}
                    className={`flex-1 py-1.5 rounded justify-center items-center ${actionType === "log" ? "bg-teal-500" : "bg-transparent"}`}
                  >
                    <Text className={`font-bold text-[9px] uppercase tracking-wider ${actionType === "log" ? "text-slate-950" : "text-slate-400"}`}>Log Only</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                onPress={handleAddRule}
                className="bg-teal-500 py-2.5 rounded-xl items-center justify-center mt-2 active:bg-teal-600"
              >
                <Text className="text-slate-950 font-black text-xs uppercase tracking-wider">Save Rule</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Active Rules List */}
          <View style={{ gap: 8 }}>
            {rules.length > 0 ? (
              rules.map((rule) => (
                <View key={rule.id} className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-3 flex-row justify-between items-center">
                  <View className="flex-1 pr-3">
                    <Text className="text-slate-200 font-bold text-xs">{rule.name}</Text>
                    <Text className="text-slate-500 text-[9px] font-semibold mt-0.5">
                      If Signal {rule.operator === "lt" ? "<" : ">"} {rule.value} dBm → {rule.actionType === "notification" ? "Push Notification" : "Silent Log"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteRule(rule.id)} className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg active:bg-rose-500/20">
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View className="bg-slate-950/20 border border-slate-800/20 rounded-xl p-4 items-center justify-center">
                <Text className="text-slate-500 text-[9px] text-center">No active automation rules defined.</Text>
              </View>
            )}
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
