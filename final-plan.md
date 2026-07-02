# NetPilot: Technical Specification & Implementation Plan

NetPilot is a modern Android network management and diagnostics application. This document outlines the selected architecture, division of labor between React Native Expo and Native Kotlin, security constraints, and a phased execution plan designed to deliver a high-quality product in **8 weeks**.

---

## 1. Architectural Decisions Summary

Based on our design alignment, NetPilot will use the following tech stack and design patterns:

*   **Deployment Target:** Dual-Target (develop a fully featured sideloadable APK first; design native modules conditionally to allow a policy-compliant Google Play version later).
*   **Authentication & Billing:** Local-First (No Login). The app operates without registration. Pro features are checked via local state or Google Play Billing queries. Cloud sync is deferred to a future iteration.
*   **Speed Test Engine:** Native Kotlin Speed Engine using multi-threaded `OkHttp` download/upload loops, emitting periodic progress events to JS via Expo Modules Event Emitter for maximum accuracy on 5G networks.
*   **Speed Test Server Strategy:** Public CDN File Endpoints (e.g., Cloudflare, Google, AWS CDN) to download test buffers and POST trash data, ensuring zero-cost, legal, and globally distributed edge performance.
*   **Database & ORM:** `expo-sqlite` combined with `Drizzle ORM` for schema management, migrations, and query execution in TypeScript, sharing the SQLite file with the background service.
*   **Styling:** `NativeWind` (Tailwind CSS) for responsive, utility-first layout management.
*   **Charts:** `Victory Native XL` (built on top of Shopify's `React Native Skia`) for buttery-smooth rendering of real-time signal and speed graphs.
*   **Background Telemetry:** Adaptive / Passive Logging. The Kotlin Foreground Service listens to `TelephonyCallback` and location shifts, inserting records only on state changes (e.g., cell handoff, signal shift > 5dBm, distance change > 50m) to minimize battery drain.
*   **Foreground Notification:** Dynamic Telemetry Notification. Displays a silent, low-priority notification showing active network carrier, type, and signal strength (e.g., `"Connected to Jio 5G SA • -85 dBm"`), updating dynamically in the background.
*   **LAN Device Discovery:** Basic Ping Sweep & Host Discovery implemented in a native Kotlin module using multi-threaded ICMP pings and NetBIOS/mDNS resolution, coupled with an offline MAC vendor database lookup.
*   **Ping / Latency Targets:** Public DNS servers (e.g., Cloudflare `1.1.1.1` and Google `8.8.8.8`) for real-time ping and jitter calculation via native ICMP/UDP sockets.
*   **WiFi Analyzer Visualization:** Dual Mode (Overlapping parabolic channel curves for 2.4/5/6 GHz alongside a ranked quality rating list from 1–10).
*   **Mapping Provider:** Google Maps SDK via `react-native-maps` for high-performance vector rendering, heatmaps, and coordinate tracing.
*   **Smart Rules Engine:** Visual JSON Builder. Triggers and conditions are defined in a GUI, stored as JSON in SQLite, and evaluated on both the JS thread (foreground) and within the Kotlin Foreground Service (background).

---

## 2. Expo (React Native) vs. Native Kotlin Feasibility Matrix

| Feature Area | React Native / Expo (TS) | Native Kotlin Required? | Android OS Limitations / Constraints |
| :--- | :--- | :--- | :--- |
| **User Interface & State** | 100% (React Native, NativeWind, Zustand) | No | None. |
| **Data Visualization** | 100% (Victory Native XL / RN Skia) | No | None. |
| **Local Storage** | 100% (MMKV & SQLite / Drizzle ORM) | No | Database file must be shared between JS process and the Background Service. |
| **Basic Network Status** | Yes (`expo-network` check for active interface type) | No | Only returns binary connected/disconnected and interface type (WiFi/Cellular). |
| **Cellular Signal Details** (RSRP, RSSI, RSRQ, SINR, Band, Carrier, PCI) | No | **Yes (TelephonyModule)** | Requires `READ_PHONE_STATE` and `ACCESS_FINE_LOCATION`. GPS must be enabled to retrieve active Cell IDs. |
| **Force LTE / 5G** | No | **Yes (IntentModule)** | **Hard OS Constraint:** Programs cannot toggle preferred networks directly. Requires launching system testing activity (`RadioInfo`) or OEM-specific panels. |
| **WiFi Scanning & Channels** (2.4/5/6 GHz, Congestion, RSSI of neighbors) | No | **Yes (WifiModule)** | Requires `ACCESS_FINE_LOCATION` and WiFi enabled. Scan results are throttled by Android (4 scans / 2 mins). |
| **Connected Devices Scanner** (LAN IP/MAC scan) | No | **Yes (LanScannerModule)** | Reading `/proc/net/arp` is blocked since Android 10. Requires native multi-threaded ping sweeps / MDNS queries. |
| **Background Signal Tracking** | No | **Yes (BackgroundService)** | Requires a native Android **Foreground Service** with a persistent status notification to avoid OS termination. |
| **Alert Rules Engine** | GUI & evaluation in TS (foreground) | **Yes (for background)** | Rules must be parsed and evaluated inside the native Foreground Service to run when the app is closed. |
| **Coverage Map (Heatmap)** | Yes (`react-native-maps` + Tile Overlays) | No | Background location logging requires `ACCESS_BACKGROUND_LOCATION` (highly restricted on Play Store). |

---

## 3. Technical Feasibility & Android API Safeguards

### A. Cellular Diagnostics (Telephony)
To get exact details like band numbers (e.g., LTE Band 3, 5G Band n78) and signal parameters (RSRP, RSRQ, SINR):
- **API Strategy:** We will write a native `TelephonyModule.kt` using `TelephonyManager`.
  - For Android 12+ (API 31+): Use `TelephonyManager.registerTelephonyCallback()` with `TelephonyCallback.SignalStrengthsListener` and `TelephonyCallback.CellInfoListener`.
  - For older versions: Fall back to `PhoneStateListener`.
- **Calculation of Bands:**
  - **LTE:** Read `CellIdentityLte.getEarfcn()` and calculate the band number.
  - **5G NR:** Read `CellIdentityNr.getNrarfcn()` to calculate the 5G band.
- **5G NSA vs. 5G SA:** We must check `TelephonyDisplayInfo.getOverrideNetworkType()` to distinguish real 5G (SA) from LTE-anchored 5G (NSA/LTE_CA).

### B. Force LTE / 5G (Network Toggling)
- **The Loophole:** Many apps claim to toggle network modes programmatically. In Android 11+, the function `setPreferredNetworkTypeBitmask` requires `android.permission.MODIFY_PHONE_STATE` (a signature/system permission reserved for carriers and OEMs).
- **The Workaround:** NetPilot will use a native helper to launch the hidden Android diagnostic interface (known as the `RadioInfo` testing menu) where users can manually lock their band.
  - *Primary Intent:* Action `MAIN`, Component `com.android.settings/.RadioInfo`.
  - *Secondary Fallback:* Launch `android.settings.NETWORK_OPERATOR_SETTINGS` (Mobile Network Settings page).
  - *Samsung Fallback:* Attempt to launch Samsung Band Selection Activity `com.samsung.android.app.telephonyui/.hiddennetworksetting.MainActivity`.

### C. WiFi Scanning & Network Mapping
- **SSID / BSSID Access:** Accessing WiFi details requires `ACCESS_FINE_LOCATION` and location services (GPS) turned ON. If location is off, Android returns `<unknown ssid>` and all scans will fail.
- **WiFi Scan Throttling:** Android limits foreground scan requests to 4 times every 2 minutes. The UI must handle this by displaying cached values and notifying the user of the throttling cooldown rather than failing silently.
- **LAN Device Discovery:** Since `/proc/net/arp` is restricted in Android 10+, scanning local devices requires a multi-threaded native Kotlin routine executing asynchronous ICMP pings (ping sweep) on the local subnet (e.g., `192.168.1.0/24`) and resolving names via MDNS.

### D. Persistent Background Monitoring
- **The Loophole:** Standard React Native background tasks (`expo-task-manager`) will be killed by Android's Doze mode and memory management.
- **The Solution:** We must write a native Android `ForegroundService`. It runs in a separate native thread, holds a wake lock, displays a persistent notification, and registers a callback to monitor signal and location changes.
- **Database Architecture:** The background service needs to write directly to a local SQLite database so it can log network states even when the React Native Javascript thread is completely suspended. We will use SQLite via React Native but write native bindings or shared file systems for background-to-foreground data access.

---

## 4. Recommended Project Directory Structure

```text
netpilot/
├── android/                   # Generated native project (managed via Expo prebuild)
├── modules/                   # Custom Expo Modules (Kotlin + TS Declarations)
│   ├── cellular-diagnostics/
│   │   ├── android/src/main/java/expo/modules/cell/CellularDiagnosticsModule.kt
│   │   ├── index.ts
│   │   └── expo-module.config.json
│   ├── wifi-analyzer/
│   │   ├── android/src/main/java/expo/modules/wifi/WifiAnalyzerModule.kt
│   │   ├── index.ts
│   │   └── expo-module.config.json
│   ├── lan-scanner/
│   │   ├── android/src/main/java/expo/modules/lan/LanScannerModule.kt
│   │   ├── index.ts
│   │   └── expo-module.config.json
│   ├── network-speed/
│   │   ├── android/src/main/java/expo/modules/speed/NetworkSpeedModule.kt
│   │   ├── index.ts
│   │   └── expo-module.config.json
│   └── network-intent/
│       ├── android/src/main/java/expo/modules/intent/NetworkIntentModule.kt
│       ├── index.ts
│       └── expo-module.config.json
├── plugins/                   # Expo Config Plugins (to inject permissions/services)
│   └── withAndroidBackgroundService.js
├── src/
│   ├── app/                   # Expo Router File-Based Routing
│   │   ├── _layout.tsx
│   │   ├── (tabs)/
│   │   │   ├── index.tsx      # Dashboard
│   │   │   ├── cellular.tsx   # Cell details & Signal graphs
│   │   │   ├── wifi.tsx       # Wifi channels & LAN scans
│   │   │   ├── speed.tsx      # Speed test UI
│   │   │   └── settings.tsx   # App config & Rules
│   ├── features/              # Feature-specific components and business logic
│   │   ├── cellular/
│   │   ├── wifi/
│   │   ├── speed/
│   │   └── rules/
│   ├── components/            # Reusable UI widgets, cards, and charts
│   │   ├── ui/
│   │   └── charts/            # Victory Native XL components
│   ├── store/                 # State management (Zustand + MMKV)
│   │   └── useAppStore.ts
│   ├── database/              # SQLite DB logic (Drizzle or Expo-SQLite)
│   │   └── schema.ts
│   └── utils/
├── app.json                   # Expo Configuration with plugins and permissions
├── package.json
└── final-plan.md              # This document
```

---

## 5. Phased Development Roadmap (8-Week Timeline)

This timeline gets NetPilot fully built, tested, and ready for deployment in 8 weeks.

### Phase 1: Setup, Architecture & Database (Days 1–6)
- **Goal:** Establish a robust Expo container configured for native Kotlin development.
- **Tasks:**
  1. Initialize Expo project with typescript template.
  2. Setup **Expo Prebuild** configuration. Avoid manual changes in `/android`; instead, write **Expo Config Plugins** to inject permissions and services into `AndroidManifest.xml`.
  3. Install and configure `react-native-mmkv` for high-speed key-value storage.
  4. Install `expo-sqlite` (or `drizzle-orm` + `expo-sqlite`) to handle local time-series tables.
  5. Build the navigation frame using Expo Router.

### Phase 2: Native Telephony Module & Dashboard MVP (Days 7–15)
- **Goal:** Real-time mobile diagnostic dashboard and cell signal rendering.
- **Tasks:**
  1. Implement `CellularDiagnosticsModule.kt` to extract RSRP, RSSI, Band, and Carrier.
  2. Implement `NetworkIntentModule.kt` to launch hidden settings menus (`RadioInfo`, Samsung band-lock).
  3. Build UI for the main Dashboard (Signal strength, Tech type, Gateway, DNS, VPN status).
  4. Implement real-time line charts of Signal Strength (dBm) vs Time using **Victory Native XL**.

### Phase 3: Speed Test Engine & WiFi Analyzer (Days 16–29)
- **Goal:** Network diagnostics toolset (WiFi channels, LAN scan, Speed test).
- **Tasks:**
  1. Write `WifiAnalyzerModule.kt` for WiFi AP discovery (SSID, RSSI, Channel, Frequency).
  2. Build Channel Analyzer UI mapping 2.4/5/6 GHz congestion levels.
  3. Build Native Speed Test engine (`NetworkSpeedModule.kt`) in Kotlin using OkHttp chunked downloads/uploads, transmitting progress to JS.
  4. Write `LanScannerModule.kt` to perform fast ping sweeps and discover connected devices on the local router.

### Phase 4: Foreground Monitoring Service & DB Sync (Days 30–39)
- **Goal:** Keep tracking network quality when screen is off.
- **Tasks:**
  1. Write custom Kotlin Foreground Service displaying a persistent notification.
  2. Register background location and telephony listener inside the service using Adaptive/Passive logging hooks.
  3. Program the service to write data points directly to SQLite every time a threshold is breached (signal delta > 5dBm, cell handover, distance delta > 50m).
  4. Synchronize data from SQLite to the React Native app when it resumes foreground status.

### Phase 5: Coverage Heatmaps & Smart Rules (Days 40–48)
- **Goal:** Spatial visualization of network performance and automated rules.
- **Tasks:**
  1. Integrate `react-native-maps` and build a Coverage Map showing colored signal/speed pins (Red = poor, Green = strong).
  2. Implement Heatmap overlays using coordinates recorded by the background service.
  3. Build the Smart Rules Engine Visual JSON Builder UI.
  4. Integrate JSON rule evaluation logic into both the TS layer and the Kotlin Foreground Service.

### Phase 6: OEM Polish, Play Store Optimization & Testing (Days 49–56)
- **Goal:** Cross-device stability and deployment-ready bundle.
- **Tasks:**
  1. OEM Optimization: Test special band locking intents on Samsung, Xiaomi, and Pixel devices. Handle failures gracefully with user dialogs.
  2. Implement proper location permissions dialog sequences, explaining exactly why location is required for cellular/WiFi data.
  3. Optimize Kotlin code to minimize battery consumption in the background.
  4. Perform test builds using EAS Build (Generate AAB and APK).

---

## 6. Security & Manifest Setup (Config Plugin approach)

To avoid breaking the Expo workflow, all permissions and services must be declared in `app.json` via config plugins. The following permissions will be declared:

```json
{
  "expo": {
    "name": "NetPilot",
    "slug": "netpilot",
    "android": {
      "permissions": [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.ACCESS_WIFI_STATE",
        "android.permission.CHANGE_WIFI_STATE",
        "android.permission.READ_PHONE_STATE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.WAKE_LOCK"
      ]
    }
  }
}
```

*Note: For Play Store approval, the background location permission will require a comprehensive privacy policy and video submission explaining the background tracking feature.*

---

## 7. OEM Compatibility & Workarounds

| Manufacturer | Known Quirks | Workaround Plan |
| :--- | :--- | :--- |
| **Samsung** | Blocks standard `*#*#4636#*#*` intent in newer One UI builds. | Fall back to trying `com.samsung.android.app.telephonyui.hiddennetworksetting.MainActivity` or guide user to generic Mobile Network settings. |
| **Xiaomi / Poco** | Aggressive background task killing. | Show a custom UI guide prompting the user to whitelist NetPilot under "Battery Optimization" -> "No Restrictions". |
| **Pixel** | Strict adherence to standard APIs. | No special quirks; standard API works perfectly. |
| **OnePlus / Oppo / Realme** | Intent blocks can happen on standard testing menus. | Gracefully handle Intent exceptions using native Kotlin try/catch blocks; present a fallback dialog linking directly to Mobile Settings. |
