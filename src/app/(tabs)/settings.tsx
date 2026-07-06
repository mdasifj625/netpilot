import React, { useState } from "react";
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert, TextInput, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { desc, eq } from "drizzle-orm";
import { Sliders, Bell, HelpCircle, History, Trash2, AlertCircle } from "lucide-react-native";

// Import modules, stores, and DB
import {
  startBackgroundService,
  stopBackgroundService,
  setPowerSaverEnabled,
} from "../../../modules/cellular-diagnostics";
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
  const [triggerType, setTriggerType] = useState<"signal" | "speed" | "battery">("signal");
  const [operator, setOperator] = useState<"lt" | "gt">("lt");
  const [value, setValue] = useState("");
  const [actionType, setActionType] = useState<"notification" | "log" | "pause_tracking">("notification");

  // CSV Export States
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [rawCsv, setRawCsv] = useState("");

  const fetchLogs = async () => {
    try {
      const history = await db.select().from(networkHistory).orderBy(desc(networkHistory.timestamp)).limit(10);
      setLogs(history);
    } catch (e) {
      console.error("Failed to query log history:", e);
    }
  };

  const fetchRules = async () => {
    try {
      const activeRules = await db.select().from(automationRules);
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

  const handleToggleMultiConnection = (val: boolean) => {
    updateSettings({ isMultiConnection: val });
  };

  const TEST_SERVERS = [
    { id: "cloudflare-auto", name: "Cloudflare (Auto Nearest)", dl: "https://speed.cloudflare.com/__down?bytes=250000000", ul: "https://speed.cloudflare.com/__up" },
    { id: "aws-edge", name: "AWS Edge (Mock)", dl: "https://speed.cloudflare.com/__down?bytes=250000000", ul: "https://speed.cloudflare.com/__up" },
    { id: "fastly-edge", name: "Fastly CDN (Mock)", dl: "https://speed.cloudflare.com/__down?bytes=250000000", ul: "https://speed.cloudflare.com/__up" }
  ];

  const handleClearLogs = async () => {
    Alert.alert("Confirm Action", "Are you sure you want to delete all logged network history?", [
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
        },
      },
    ]);
  };

  const handleExportCSV = async () => {
    try {
      const allLogs = await db.select().from(networkHistory).orderBy(desc(networkHistory.timestamp));

      if (allLogs.length === 0) {
        Alert.alert("No Data", "There is no logged telemetry data to export.");
        return;
      }

      const headers =
        "id,timestamp,carrier,network_type,signal_dbm,download_mbps,upload_mbps,ping_ms,latitude,longitude\n";
      const rows = allLogs
        .map((log: any) => {
          const timeStr = new Date(log.timestamp).toISOString();
          return `${log.id},"${timeStr}","${log.carrier || "WiFi"}","${log.networkType}",${log.signal ?? ""},${log.download ?? ""},${log.upload ?? ""},${log.ping ?? ""},${log.latitude ?? ""},${log.longitude ?? ""}`;
        })
        .join("\n");

      const csvString = headers + rows;

      if (Platform.OS === "web") {
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "netpilot_telemetry.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setRawCsv(csvString);
        setShowCsvModal(true);
      }
    } catch (e) {
      console.error("Failed to compile CSV logs:", e);
    }
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
        isActive: true,
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

  const handleToggleRuleActive = async (id: number, currentActive: boolean) => {
    try {
      await db.update(automationRules).set({ isActive: !currentActive }).where(eq(automationRules.id, id));
      fetchRules();
    } catch (e) {
      console.error("Failed to toggle rule active state:", e);
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: "#020617" }} className="flex-1 bg-slate-950">
      <ScrollView
        style={{ flex: 1 }}
        className="flex-1 px-4 py-2"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 16 }}
      >
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

        {/* Speed Test Settings */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg" style={{ gap: 12 }}>
          <View className="flex-row items-center gap-2 mb-2">
            <Sliders size={18} color="#818cf8" />
            <Text className="text-sm font-bold text-slate-200">Speed Test Configuration</Text>
          </View>

          <View className="flex-row justify-between items-center py-2.5">
            <View className="flex-1 pr-4">
              <Text className="text-slate-200 font-semibold text-sm">Multi Connection</Text>
              <Text className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                Use multiple simultaneous streams to maximize throughput, or single stream to diagnose throttling.
              </Text>
            </View>
            <Switch
              value={settings.isMultiConnection}
              onValueChange={handleToggleMultiConnection}
              trackColor={{ false: "#1e293b", true: "#818cf8" }}
              thumbColor={settings.isMultiConnection ? "#f8fafc" : "#64748b"}
            />
          </View>

          <View className="mt-2 pt-4 border-t border-slate-800/40">
            <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-2">
              Select Edge Server
            </Text>
            <View style={{ gap: 8 }}>
              {TEST_SERVERS.map((srv) => (
                <TouchableOpacity
                  key={srv.id}
                  onPress={() => updateSettings({ selectedServerId: srv.id, customDownloadUrl: srv.dl, customUploadUrl: srv.ul })}
                  className={`px-3 py-2.5 rounded-xl border ${
                    settings.selectedServerId === srv.id
                      ? "bg-indigo-500/10 border-indigo-500/40"
                      : "bg-slate-950/40 border-slate-800"
                  }`}
                >
                  <Text className={`text-xs font-semibold ${settings.selectedServerId === srv.id ? "text-indigo-400" : "text-slate-300"}`}>
                    {srv.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* SQLite Logs History Viewer */}
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2.5">
              <History size={18} color="#818cf8" />
              <Text className="text-sm font-bold text-slate-200">Recent SQLite Logs</Text>
            </View>
            <View className="flex-row items-center gap-2">
              {logs.length > 0 && (
                <>
                  <TouchableOpacity
                    onPress={handleExportCSV}
                    className="p-1 px-2.5 bg-slate-800 border border-slate-700/60 rounded-lg active:bg-slate-700"
                  >
                    <Text className="text-indigo-400 font-extrabold text-[9px] uppercase tracking-wider">Export</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleClearLogs} className="p-1">
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {logs.length > 0 ? (
            <View style={{ gap: 8 }}>
              {logs.map((log) => {
                const date = new Date(log.timestamp).toLocaleTimeString();
                return (
                  <View
                    key={log.id}
                    className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-3 flex-row justify-between items-center"
                  >
                    <View>
                      <Text className="text-slate-200 font-bold text-xs">{log.carrier || "WiFi"}</Text>
                      <Text className="text-slate-500 text-[9px] font-medium mt-0.5">
                        {date} • {log.networkType}
                      </Text>
                    </View>
                    <View className="items-end">
                      {log.signal !== null ? (
                        <Text
                          className={`font-extrabold text-xs ${log.signal >= -90 ? "text-emerald-400" : log.signal >= -105 ? "text-amber-400" : "text-rose-400"}`}
                        >
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

              <View>
                <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Trigger Type</Text>
                <View className="flex-row bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                  <TouchableOpacity
                    onPress={() => {
                      setTriggerType("signal");
                      setOperator("lt");
                      setActionType("notification");
                    }}
                    className={`flex-1 py-1.5 rounded justify-center items-center ${triggerType === "signal" ? "bg-teal-500" : "bg-transparent"}`}
                  >
                    <Text
                      className={`font-bold text-[9px] uppercase tracking-wider ${triggerType === "signal" ? "text-slate-950" : "text-slate-400"}`}
                    >
                      Cell Signal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setTriggerType("battery");
                      setOperator("lt");
                      setActionType("pause_tracking");
                    }}
                    className={`flex-1 py-1.5 rounded justify-center items-center ${triggerType === "battery" ? "bg-teal-500" : "bg-transparent"}`}
                  >
                    <Text
                      className={`font-bold text-[9px] uppercase tracking-wider ${triggerType === "battery" ? "text-slate-950" : "text-slate-400"}`}
                    >
                      Battery Level
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Operator</Text>
                  {triggerType === "battery" ? (
                    <View className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 justify-center h-9">
                      <Text className="text-slate-300 text-xs font-bold">&lt; (Less Than)</Text>
                    </View>
                  ) : (
                    <View className="flex-row bg-slate-900 border border-slate-800 rounded-xl p-0.5 h-9 items-center">
                      <TouchableOpacity
                        onPress={() => setOperator("lt")}
                        className={`flex-1 py-1 rounded justify-center items-center ${operator === "lt" ? "bg-teal-500" : "bg-transparent"}`}
                      >
                        <Text
                          className={`font-bold text-xs ${operator === "lt" ? "text-slate-950" : "text-slate-400"}`}
                        >
                          &lt;
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setOperator("gt")}
                        className={`flex-1 py-1 rounded justify-center items-center ${operator === "gt" ? "bg-teal-500" : "bg-transparent"}`}
                      >
                        <Text
                          className={`font-bold text-xs ${operator === "gt" ? "text-slate-950" : "text-slate-400"}`}
                        >
                          &gt;
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View className="flex-1">
                  <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">
                    {triggerType === "signal" ? "Threshold (dBm)" : "Battery Level (%)"}
                  </Text>
                  <TextInput
                    value={value}
                    onChangeText={setValue}
                    keyboardType="numeric"
                    placeholder={triggerType === "signal" ? "e.g. -110" : "e.g. 20"}
                    placeholderTextColor="#64748b"
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs font-mono h-9"
                  />
                </View>
              </View>

              <View>
                <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">Action Type</Text>
                {triggerType === "battery" ? (
                  <View className="flex-row bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                    <TouchableOpacity
                      onPress={() => setActionType("pause_tracking")}
                      className={`flex-1 py-1.5 rounded justify-center items-center ${actionType === "pause_tracking" ? "bg-teal-500" : "bg-transparent"}`}
                    >
                      <Text
                        className={`font-bold text-[9px] uppercase tracking-wider ${actionType === "pause_tracking" ? "text-slate-950" : "text-slate-400"}`}
                      >
                        Pause Tracking
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActionType("notification")}
                      className={`flex-1 py-1.5 rounded justify-center items-center ${actionType === "notification" ? "bg-teal-500" : "bg-transparent"}`}
                    >
                      <Text
                        className={`font-bold text-[9px] uppercase tracking-wider ${actionType === "notification" ? "text-slate-950" : "text-slate-400"}`}
                      >
                        Notify Alert
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="flex-row bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                    <TouchableOpacity
                      onPress={() => setActionType("notification")}
                      className={`flex-1 py-1.5 rounded justify-center items-center ${actionType === "notification" ? "bg-teal-500" : "bg-transparent"}`}
                    >
                      <Text
                        className={`font-bold text-[9px] uppercase tracking-wider ${actionType === "notification" ? "text-slate-950" : "text-slate-400"}`}
                      >
                        Notify Alert
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActionType("log")}
                      className={`flex-1 py-1.5 rounded justify-center items-center ${actionType === "log" ? "bg-teal-500" : "bg-transparent"}`}
                    >
                      <Text
                        className={`font-bold text-[9px] uppercase tracking-wider ${actionType === "log" ? "text-slate-950" : "text-slate-400"}`}
                      >
                        Log Only
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
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
                <View
                  key={rule.id}
                  className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-3 flex-row justify-between items-center"
                >
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className={`text-xs font-bold ${rule.isActive ? "text-slate-200" : "text-slate-500 line-through"}`}
                      >
                        {rule.name}
                      </Text>
                      <View
                        className={`px-1.5 py-0.5 rounded border ${
                          rule.triggerType === "battery"
                            ? "bg-amber-500/10 border-amber-500/20"
                            : "bg-teal-500/10 border-teal-500/20"
                        }`}
                      >
                        <Text
                          className={`text-[8px] font-black uppercase ${rule.triggerType === "battery" ? "text-amber-400" : "text-teal-400"}`}
                        >
                          {rule.triggerType}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-slate-500 text-[9px] font-semibold mt-0.5">
                      {rule.triggerType === "battery"
                        ? `If Battery < ${rule.value}% → ${rule.actionType === "pause_tracking" ? "Pause background logging" : "Push Notification"}`
                        : `If Signal ${rule.operator === "lt" ? "<" : ">"} ${rule.value} dBm → ${rule.actionType === "notification" ? "Push Notification" : "Silent Log"}`}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Switch
                      value={rule.isActive ?? true}
                      onValueChange={() => handleToggleRuleActive(rule.id, rule.isActive ?? true)}
                      trackColor={{ false: "#1e293b", true: "#2dd4bf" }}
                      thumbColor={rule.isActive ? "#f8fafc" : "#64748b"}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <TouchableOpacity
                      onPress={() => handleDeleteRule(rule.id)}
                      className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg active:bg-rose-500/20"
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
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

      {/* CSV Native Export Modal */}
      {showCsvModal && (
        <View className="absolute inset-0 bg-slate-950/80 items-center justify-center p-6 z-50">
          <View
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm max-h-[80%] shadow-2xl"
            style={{ gap: 14 }}
          >
            <View className="flex-row justify-between items-center border-b border-slate-800/60 pb-3">
              <Text className="text-slate-100 font-bold text-sm">CSV Export Data</Text>
              <TouchableOpacity
                onPress={() => setShowCsvModal(false)}
                className="bg-slate-800 p-1.5 rounded-full active:bg-slate-700"
              >
                <Text className="text-slate-400 font-black text-xs px-1">X</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-slate-400 text-3xs leading-relaxed">
              Select and copy the raw CSV coordinates log text below to import into your spreadsheet or GIS mapping
              software.
            </Text>

            <TextInput
              multiline
              value={rawCsv}
              editable={false}
              selectTextOnFocus
              className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-slate-300 font-mono text-[9px] h-48 text-left align-top"
            />

            <TouchableOpacity
              onPress={() => {
                Alert.alert("Text Selected", "Tap and hold inside the box to copy the full CSV log.");
              }}
              className="bg-sky-500 py-2.5 rounded-xl items-center justify-center active:bg-sky-600"
            >
              <Text className="text-slate-950 font-black text-xs uppercase tracking-wider">Select All Logs</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
