import { requireNativeModule } from 'expo-modules-core';

let WifiAnalyzer: any = null;
try {
  WifiAnalyzer = requireNativeModule('WifiAnalyzer');
} catch (e) {
  // Silent fallback for Web/iOS
}

export interface WifiScanResult {
  ssid: string;
  bssid: string;
  level: number; // dBm
  frequency: number; // MHz
  capabilities: string;
  channel: number;
  wifiStandard: string;
}

export interface ConnectedWifiInfo {
  ssid: string | null;
  bssid: string | null;
  level: number | null; // dBm
  frequency: number | null; // MHz
  linkSpeed: number | null; // Mbps
}

export function startScan(): boolean {
  return WifiAnalyzer ? WifiAnalyzer.startScan() : false;
}

export function getScanResults(): WifiScanResult[] {
  if (WifiAnalyzer) {
    return WifiAnalyzer.getScanResults();
  }
  // Mock fallback results for Web layout preview
  return [
    { ssid: "HomeWiFi_5G_Fast", bssid: "00:11:22:33:44:55", level: -45, frequency: 5180, capabilities: "WPA2/WPA3", channel: 36, wifiStandard: "Wi-Fi 6 (11ax)" },
    { ssid: "Office_Mesh_Backup", bssid: "00:11:22:33:44:66", level: -68, frequency: 2412, capabilities: "WPA2", channel: 1, wifiStandard: "Wi-Fi 4 (11n)" },
    { ssid: "Public_Hotspot_Free", bssid: "00:11:22:33:44:77", level: -82, frequency: 2437, capabilities: "None (Open)", channel: 6, wifiStandard: "Wi-Fi 5 (11ac)" }
  ];
}

export function getConnectedWifiInfo(): ConnectedWifiInfo | null {
  if (WifiAnalyzer) {
    return WifiAnalyzer.getConnectedWifiInfo();
  }
  // Mock fallback connected info for Web
  return {
    ssid: "HomeWiFi_5G_Fast",
    bssid: "00:11:22:33:44:55",
    level: -45,
    frequency: 5180,
    linkSpeed: 866
  };
}
