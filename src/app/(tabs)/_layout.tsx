import React from "react";
import { Tabs, Link } from "expo-router";
import { Platform, View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LayoutDashboard, Wifi, Gauge, Info } from "lucide-react-native";
import { AppBackground } from "../../components/AppBackground";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <Tabs
        screenOptions={{
          sceneStyle: { backgroundColor: "transparent" },
          tabBarActiveTintColor: "#0ea5e9", // Sky 500
          tabBarInactiveTintColor: "#64748b", // Slate 500
          tabBarStyle: {
            backgroundColor: "#0f172a", // Solid Slate 900
            borderTopWidth: 1,
            borderTopColor: "#1e293b",
            paddingTop: 8,
            paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 24) : Math.max(insets.bottom, 12),
            height: Platform.OS === "ios" ? 64 + Math.max(insets.bottom, 24) : 60 + Math.max(insets.bottom, 12),
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "900",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
          headerStyle: {
            backgroundColor: "#0f172a", // Solid Slate 900
            borderBottomWidth: 1,
            borderBottomColor: "#1e293b",
          },
          headerTintColor: "#f8fafc", // Slate 50
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 18,
          },
          headerRight: () => (
            <Link href="/about" asChild>
              <TouchableOpacity style={{ marginRight: 16, padding: 8 }}>
                <Info size={22} color="#94a3b8" />
              </TouchableOpacity>
            </Link>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarLabel: "Dashboard",
            headerTitle: () => (
              <View>
                <Text className="text-slate-50 font-bold text-lg">NetPilot Dashboard</Text>
                <Text className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                  Real-time telemetry
                </Text>
              </View>
            ),
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
        />

        <Tabs.Screen
          name="wifi"
          options={{
            title: "WiFi Analyzer",
            tabBarLabel: "WiFi",
            headerTitle: () => (
              <View>
                <Text className="text-slate-50 font-bold text-lg">WiFi Analyzer</Text>
                <Text className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                  Spectrum & LAN discovery
                </Text>
              </View>
            ),
            tabBarIcon: ({ color, size }) => <Wifi size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="speed"
          options={{
            title: "Speed Test",
            tabBarLabel: "Speed",
            headerTitle: () => (
              <View>
                <Text className="text-slate-50 font-bold text-lg">Speed Test</Text>
                <Text className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                  Bandwidth throughput
                </Text>
              </View>
            ),
            tabBarIcon: ({ color, size }) => <Gauge size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
