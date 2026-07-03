import { requireNativeModule, EventEmitter } from 'expo-modules-core';

let CellularDiagnostics: any = null;
try {
  CellularDiagnostics = requireNativeModule('CellularDiagnostics');
} catch (e) {
  // Silent fallback for unsupported platforms (e.g. Web/iOS)
}

export interface CellularDiagnosticsData {
  carrier: string | null;
  networkType: string;
  rsrp: number | null;
  rsrq: number | null;
  rssi: number | null;
  sinr: number | null;
  band: number | null;
  pci: number | null;
  tac: number | null;
  cid: number | null;
  cgi: string | null;
  isRegistered: boolean;
  error?: string;
}

export interface NetworkDetailsData {
  ipAddress: string | null;
  gateway: string | null;
  dns: string | null;
  vpnActive: boolean;
}

const emitter = CellularDiagnostics ? new EventEmitter(CellularDiagnostics) : null;

export function getSignalStrength(): number | null {
  return CellularDiagnostics ? CellularDiagnostics.getSignalStrength() : -75;
}

export function getCellularDetails(): CellularDiagnosticsData | null {
  if (CellularDiagnostics) {
    return CellularDiagnostics.getCellularDetails();
  }
  // Mock fallback for Web
  return {
    carrier: "Mock Carrier (Web)",
    networkType: "5G SA (Web)",
    rsrp: -78,
    rsrq: -12,
    rssi: -55,
    sinr: 15,
    band: 78,
    pci: 312,
    tac: 4636,
    cid: 1234567,
    cgi: "405-840-4636-1234567",
    isRegistered: true
  };
}

export function getNetworkDetails(): NetworkDetailsData | null {
  if (CellularDiagnostics) {
    return CellularDiagnostics.getNetworkDetails();
  }
  // Mock fallback for Web
  return {
    ipAddress: "192.168.1.52",
    gateway: "192.168.1.1",
    dns: "1.1.1.1, 8.8.8.8",
    vpnActive: false
  };
}

export function startBackgroundService(): boolean {
  return CellularDiagnostics ? CellularDiagnostics.startBackgroundService() : false;
}

export function stopBackgroundService(): boolean {
  return CellularDiagnostics ? CellularDiagnostics.stopBackgroundService() : false;
}

export function setPowerSaverEnabled(enabled: boolean): boolean {
  return CellularDiagnostics ? CellularDiagnostics.setPowerSaverEnabled(enabled) : false;
}

export function addSignalStrengthListener(
  listener: (event: { rsrp: number | null; networkType: string }) => void
): { remove(): void } {
  if (emitter) {
    return (emitter as any).addListener('onSignalStrengthChanged', listener);
  }
  return { remove: () => {} };
}
