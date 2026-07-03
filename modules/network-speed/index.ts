import { requireNativeModule, EventEmitter } from 'expo-modules-core';

let NetworkSpeed: any = null;
try {
  NetworkSpeed = requireNativeModule('NetworkSpeed');
} catch (e) {
  // Silent fallback for Web/iOS
}

export interface SpeedTestProgressEvent {
  type: 'download' | 'upload';
  speedMbps: number;
  progress: number;
}

export interface SpeedTestFinishedEvent {
  type: 'download' | 'upload';
  averageSpeedMbps: number;
}

export interface PingFinishedEvent {
  pingMs: number;
  jitterMs: number;
}

const emitter = NetworkSpeed ? new EventEmitter(NetworkSpeed) : null;

export function startSpeedTest(downloadUrl: string, uploadUrl: string): boolean {
  if (NetworkSpeed) {
    return NetworkSpeed.startSpeedTest(downloadUrl, uploadUrl);
  }
  console.log("MockSpeed: Initiated download/upload stream test cycles");
  return false;
}

export function stopSpeedTest(): boolean {
  if (NetworkSpeed) {
    return NetworkSpeed.stopSpeedTest();
  }
  return false;
}

export function addSpeedProgressListener(
  listener: (event: SpeedTestProgressEvent) => void
): { remove(): void } {
  if (emitter) {
    return (emitter as any).addListener('onSpeedTestProgress', listener);
  }
  return { remove: () => {} };
}

export function addSpeedFinishedListener(
  listener: (event: SpeedTestFinishedEvent) => void
): { remove(): void } {
  if (emitter) {
    return (emitter as any).addListener('onSpeedTestFinished', listener);
  }
  return { remove: () => {} };
}

export function addPingFinishedListener(
  listener: (event: PingFinishedEvent) => void
): { remove(): void } {
  if (emitter) {
    return (emitter as any).addListener('onPingFinished', listener);
  }
  return { remove: () => {} };
}
