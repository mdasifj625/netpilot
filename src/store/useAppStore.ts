import { create } from "zustand";
import { persist, StateStorage, createJSONStorage } from "zustand/middleware";
import { Platform } from "react-native";

import { createMMKV } from "react-native-mmkv";

// Web Mock for MMKV utilizing standard browser localStorage
class WebMMKV {
  private memoryStore: { [key: string]: string } = {};

  set(key: string, value: string | number | boolean | Uint8Array) {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, String(value));
    } else {
      this.memoryStore[key] = String(value);
    }
  }

  getString(key: string): string | undefined {
    if (typeof window !== "undefined" && window.localStorage) {
      const val = window.localStorage.getItem(key);
      return val !== null ? val : undefined;
    }
    return this.memoryStore[key];
  }

  remove(key: string) {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    } else {
      delete this.memoryStore[key];
    }
  }
}

// Initialize platform-specific storage instance
export const appStorage = Platform.OS === "web" ? new WebMMKV() : createMMKV({ id: "netpilot-settings" });

// Create a custom storage wrapper for Zustand persistence middleware
const zustandStorage: StateStorage = {
  setItem: (name, value) => {
    appStorage.set(name, value);
  },
  getItem: (name) => {
    const value = appStorage.getString(name);
    return value ?? null;
  },
  removeItem: (name) => {
    appStorage.remove(name);
  },
};

interface AppSettings {
  backgroundTrackingEnabled: boolean;
  powerSaverEnabled: boolean;
  pingIntervalMs: number;
  weakSignalThresholdDbm: number;
  slowSpeedThresholdMbps: number;
  isDarkTheme: boolean;
  customDownloadUrl: string;
  customUploadUrl: string;
  customPingTarget: string;
  selectedServerId: string;
  isMultiConnection: boolean;
}

interface AppStore {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  backgroundTrackingEnabled: false,
  powerSaverEnabled: false,
  pingIntervalMs: 2000,
  weakSignalThresholdDbm: -105,
  slowSpeedThresholdMbps: 10,
  isDarkTheme: true,
  customDownloadUrl: "",
  customUploadUrl: "",
  customPingTarget: "https://1.1.1.1",
  selectedServerId: "cloudflare-auto",
  isMultiConnection: true,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "netpilot-state",
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
export default useAppStore;
