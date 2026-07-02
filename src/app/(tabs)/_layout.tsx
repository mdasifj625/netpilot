import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { LayoutDashboard, Radio, Wifi, Gauge, Settings } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0ea5e9", // Sky 500
        tabBarInactiveTintColor: "#64748b", // Slate 500
        tabBarStyle: {
          backgroundColor: "#0f172a", // Slate 900
          borderTopWidth: 1,
          borderTopColor: "#1e293b", // Slate 800
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: "#0f172a", // Slate 900
          borderBottomWidth: 1,
          borderBottomColor: "#1e293b", // Slate 800
        },
        headerTintColor: "#f8fafc", // Slate 50
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cellular"
        options={{
          title: "Cellular",
          tabBarLabel: "Cellular",
          tabBarIcon: ({ color, size }) => <Radio size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wifi"
        options={{
          title: "WiFi Analyzer",
          tabBarLabel: "WiFi",
          tabBarIcon: ({ color, size }) => <Wifi size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="speed"
        options={{
          title: "Speed Test",
          tabBarLabel: "Speed",
          tabBarIcon: ({ color, size }) => <Gauge size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
