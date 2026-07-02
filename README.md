# NetPilot

NetPilot is a modern, high-performance Android network diagnostics, telemetry, and management application. It is built using **React Native Expo (SDK 57)** for the user interface and state management, coupled with **Custom Native Kotlin Modules** for low-level hardware telemetry.

---

## 🚀 Features Built So Far

1.  **Dashboard Screen (`src/app/(tabs)/index.tsx`)**: Displays active internet status, cellular details, IP configurations (local IP, Gateway, DNS, VPN status), and location permission banners.
2.  **Cellular Diagnostics (`src/app/(tabs)/cellular.tsx`)**: Shows physical signal values (RSRP, RSRQ, RSSI, SINR) and network tower IDs (PCI, TAC, CID, CGI). It calculates the active **eNodeB ID** and **Sector ID** from the LTE CID and renders a rolling 20-sample signal history chart.
3.  **WiFi Analyzer (`src/app/(tabs)/wifi.tsx`)**: Scans surrounding access points, rating the optimal non-overlapping channels (1, 6, 11) in the 2.4 GHz band, showing SSID, RSSI, frequency, and Wi-Fi standard (Wi-Fi 4/5/6/7).
4.  **LAN Devices Scanner (`src/app/(tabs)/wifi.tsx` - LAN Tab)**: Performs fast, parallel multi-threaded subnet ICMP ping sweeps (using a native pool of 40 Kotlin threads) to list active IPs, hostnames, and round-trip latencies.
5.  **Speed Test (`src/app/(tabs)/speed.tsx`)**: Executes multi-threaded ping/jitterHEAD checks and OkHttp-based upload/download tests against public Cloudflare edge CDN endpoints, saving results to SQLite.
6.  **Background Logging Engine (`modules/cellular-diagnostics/.../BackgroundService.kt`)**: An Android Foreground Service that runs on a separate native thread, updates a dynamic telemetry notification, and registers listeners to log signal/location updates into SQLite whenever thresholds are breached (adaptive logging).
7.  **Settings & Logs viewer (`src/app/(tabs)/settings.tsx`)**: Configures logging thresholds, toggles the native Foreground Service, and displays recent log records fetched from SQLite.

---

## 🛠️ Project Architecture

```text
netpilot/
├── .agents/                   # AI Assistant rules and guidelines (AGENTS.md)
├── app.json                   # Expo configs, permissions, and plugin lists
├── package.json               # JavaScript dependencies and build scripts
├── postcss.config.mjs         # PostCSS configuration for Tailwind v4
├── metro.config.js            # Metro bundler with NativeWind v5 wrapper
├── global.css                 # Global CSS importing Tailwind classes
├── plugins/                   # Custom Expo Config Plugins
│   └── withAndroidBackgroundService.js  # Injects BackgroundService into Manifest
├── modules/                   # Local Native Kotlin Modules (Expo autolinked)
│   ├── cellular-diagnostics/  # Telephony, IP metrics, & BackgroundService
│   ├── network-intent/        # launches hidden system diagnostic settings
│   ├── wifi-analyzer/         # Wi-Fi scanner and connection properties
│   ├── lan-scanner/           # Subnet ICMP sweeps & host resolver
│   └── network-speed/         # OkHttp speed test loops
└── src/
    ├── app/                   # File-based routing (Expo Router)
    ├── store/                 # Zustand state + MMKV persistent settings
    └── database/              # SQLite database initialization & Drizzle schemas
```

---

## 📦 How to Build and Run the App

NetPilot contains native Kotlin code compiled during the bundle step. Follow the setup below to compile and execute:

### 1. System Prerequisites
*   **NodeJS** (v18+) & **Yarn** (v1.22+)
*   **Java Development Kit (JDK) 17**: Required for compiling Android SDK 35 targets.
*   **Android SDK**: Command Line Tools or Android SDK Platform-tools (specifically `adb` and build-tools).

### 2. VSCode vs. Android Studio: What is required?
*   **VSCode is enough for development**: You do **NOT** need to open Android Studio to build, compile, and run the app. Expo's CLI compiles the Android Gradle project completely via the command line.
*   **When Android Studio is useful**:
    *   Creating and launching Android Virtual Devices (AVD Emulator).
    *   Inspecting background logs, memory profiles, or Kotlin stack traces via **Logcat**.
    *   Inspecting database tables in real-time.

### 3. Step-by-Step Execution Guide

#### Step A: Install dependencies
Install JavaScript modules and configure local binary locks:
```bash
yarn install
```

#### Step B: Generate Native Project Files (Prebuild)
Run Expo Prebuild to generate the native `/android` directory and run our Config Plugins:
```bash
npx expo prebuild --platform android --no-install
```

#### Step C: Build and Boot on Emulator/Device
Connect a physical Android device (with USB Debugging enabled) or boot an AVD Emulator. Then compile the app:
```bash
npx expo run:android
```
*Note: This command compiles the Gradle project, installs the APK, and starts the Metro bundler.*

#### Step D: Run Development Server
If you only need to start the Metro bundler without rebuilding the APK (already installed):
```bash
npx expo start
```

---

## 🔒 Permissions & Security Notes
Because NetPilot reads cellular network channels and searches for local devices, it requests the following permissions on boot:
*   `ACCESS_FINE_LOCATION`: Required to access cell tower details and perform Wi-Fi scans.
*   `READ_PHONE_STATE`: Required to read active carrier telemetry.
*   `FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_SPECIAL_USE`: Required to register the telemetry service in the background.

---

## 🔍 Debugging & Viewing Native Logs

NetPilot's codebase runs across two runtime environments, meaning logging is split:

1.  **JavaScript/TypeScript Logs** (`console.log`, `console.warn`):
    These show up directly in the terminal where you run `npx expo start` or `npx expo run:android` via Metro.
2.  **Native Kotlin Logs** (`Log.d`, `Log.w`, `Log.e`):
    These are printed to the Android system log buffer (Logcat) and do **not** appear in the standard Metro development console.

### Viewing Native Logs in VSCode (Without Android Studio)
You can stream and filter native log tags directly in your VSCode terminal using the Android Debug Bridge (`adb`):

*   **Filter all logs from the NetPilot process**:
    ```bash
    adb logcat --pid=$(adb shell pidof -s com.superhero.netpilot)
    ```
*   **Filter specifically by custom module tag**:
    ```bash
    adb logcat *:S CellularDiagnostics:D BackgroundService:D WifiAnalyzer:D LanScanner:D NetworkSpeed:D
    ```
*   **Simple text search**:
    ```bash
    adb logcat | grep -i "netpilot"
    ```
