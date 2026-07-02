import { requireNativeModule } from 'expo-modules-core';

let NetworkIntent: any = null;
try {
  NetworkIntent = requireNativeModule('NetworkIntent');
} catch (e) {
  // Silent fallback for Web/iOS
}

export function launchRadioInfo(): boolean {
  if (NetworkIntent) {
    return NetworkIntent.launchRadioInfo();
  }
  console.log("MockIntent: Launching RadioInfo hidden menu (*#*#4636#*#*)");
  return false;
}

export function launchMobileNetworkSettings(): boolean {
  if (NetworkIntent) {
    return NetworkIntent.launchMobileNetworkSettings();
  }
  console.log("MockIntent: Launching Mobile Network Settings Page");
  return false;
}

export function launchSamsungBandSelection(): boolean {
  if (NetworkIntent) {
    return NetworkIntent.launchSamsungBandSelection();
  }
  console.log("MockIntent: Launching Samsung Band Selection Hidden Menu");
  return false;
}
