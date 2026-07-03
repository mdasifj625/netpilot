import { create } from "zustand";
import { persist, StateStorage, createJSONStorage } from "zustand/middleware";
import { Platform } from "react-native";

// Web Mock for MMKV utilizing standard browser localStorage
class WebMMKV {
  set(key: string, value: string | number | boolean | Uint8Array) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, String(value));
    }
  }

  getString(key: string): string | undefined {
    if (typeof window !== "undefined") {
      const val = window.localStorage.getItem(key);
      return val !== null ? val : undefined;
    }
    return undefined;
  }

  delete(key: string) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  }
}

// Load Native MMKV conditionally on mobile
let NativeMMKV: any = null;
if (Platform.OS !== "web") {
  try {
    NativeMMKV = require("react-native-mmkv").MMKV;
  } catch (e) {
    console.error("MMKV loading failed:", e);
  }
}

// Initialize platform-specific storage instance
export const appStorage = Platform.OS === "web" || !NativeMMKV
  ? new WebMMKV()
  : new NativeMMKV({ id: "netpilot-settings" });

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
    appStorage.delete(name);
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
