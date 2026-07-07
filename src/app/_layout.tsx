import "../../global.css";
import React from "react";
import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

LogBox.ignoreLogs(["[react-native-skia] SkPath.addPath() is deprecated"]);

const queryClient = new QueryClient();

export default function RootLayout() {
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
              headerTitleStyle: { fontWeight: "bold" }
            }} 
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
