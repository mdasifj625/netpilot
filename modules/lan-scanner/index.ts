import { requireNativeModule, EventEmitter } from 'expo-modules-core';

let LanScanner: any = null;
try {
  LanScanner = requireNativeModule('LanScanner');
} catch (e) {
  // Silent fallback for Web/iOS
}

export interface DiscoveredDevice {
  ip: string;
  hostname: string | null;
  ping: number;
}

const emitter = LanScanner ? new EventEmitter(LanScanner) : null;

export function startScan(): boolean {
  if (LanScanner) {
    return LanScanner.startScan();
  }
  console.log("MockLAN: Started multi-threaded LAN ping sweep scan");
  return false;
}

export function stopScan(): boolean {
  if (LanScanner) {
    return LanScanner.stopScan();
  }
  return false;
}

export function addDeviceFoundListener(
  listener: (device: DiscoveredDevice) => void
): { remove(): void } {
  if (emitter) {
    return (emitter as any).addListener('onDeviceFound', listener);
  }
  return { remove: () => {} };
}

export function addScanProgressListener(
  listener: (event: { progress: number }) => void
): { remove(): void } {
  if (emitter) {
    return (emitter as any).addListener('onScanProgress', listener);
  }
  return { remove: () => {} };
}

export function addScanFinishedListener(
  listener: (event: { devicesCount: number }) => void
): { remove(): void } {
  if (emitter) {
    return (emitter as any).addListener('onScanFinished', listener);
  }
  return { remove: () => {} };
}

export function scanDevicePorts(ip: string): Promise<number[]> {
  if (LanScanner) {
    return LanScanner.scanDevicePorts(ip);
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      if (ip.endsWith(".1")) {
        resolve([80, 443]);
      } else {
        resolve([]);
      }
    }, 400);
  });
}
