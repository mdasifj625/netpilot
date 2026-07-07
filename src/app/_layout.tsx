import "../../global.css";
import React, { useEffect } from "react";
import { LogBox, PermissionsAndroid, Platform } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

LogBox.ignoreLogs(["[react-native-skia] SkPath.addPath() is deprecated"]);

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    async function requestPermissions() {
      if (Platform.OS === "android") {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        ];

        if (Number(Platform.Version) >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }

        try {
          await PermissionsAndroid.requestMultiple(permissions);
        } catch (err) {
          console.warn("Failed to request permissions:", err);
        }
      }
    }
    requestPermissions();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="about"
            options={{
              headerShown: true,
              presentation: "modal",
              headerTitle: "About NetPilot",
              headerStyle: { backgroundColor: "#0f172a" },
              headerTintColor: "#f8fafc",
              headerTitleStyle: { fontWeight: "bold" },
            }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
