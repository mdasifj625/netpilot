# NetPilot: AI Agents Instruction Manual (AGENTS.md)

This file contains architectural guidelines, code styling rules, and constraints for AI Coding Assistants (including Google Antigravity, OpenAI Codex, Anthropic Claude, and others) when working on the NetPilot codebase.

---

## 1. Core Architecture Overview

NetPilot is built on a hybrid architecture combining **React Native Expo (SDK 57)** and **Custom Local Kotlin Modules** mapped via the Expo Modules API.

*   **UI & State Layer:** Coded in TypeScript using Expo Router (file-based navigation), Zustand for settings cache (backed by MMKV), and Drizzle ORM for local diagnostics querying (backed by SQLite).
*   **Native Telemetry Layer:** Coded in Kotlin inside autonomous local modules under `/modules/`.
*   **Background Logging Engine:** Implemented as a native Android `ForegroundService` in Kotlin that writes directly to the SQLite database file while the JS thread is suspended.

---

## 2. Crucial Constraints for AI Agents

> [!IMPORTANT]
> **Never modify files inside the `/android` directory directly.**
> The `/android` folder is generated dynamically. Any manual changes made in `/android` will be permanently lost during the next `npx expo prebuild`.
> 
> *   **Manifest & Gradle Modifications:** Always write Expo Config Plugins (under `/plugins/`) to inject permissions, configurations, or services.
> *   **Native Source Code Modifications:** Always implement native Kotlin features inside the autolinked modules under `/modules/`.

### Database Schema Synchronicity
If you modify the database schema in `src/database/schema.ts`:
1.  Update the raw SQL string inside `src/database/db.ts` (used by the TypeScript runtime on startup).
2.  Update the SQLite schema inserts inside `modules/cellular-diagnostics/android/src/main/java/com/superhero/netpilot/cellular/BackgroundService.kt` (used by the background Kotlin thread).

### Event Emitters and Module autolinking
When adding native methods:
1.  Define the function in the Kotlin `ModuleDefinition` block using `Function("methodName") { ... }` or `Events("eventName")`.
2.  Update the corresponding TypeScript export in `modules/<module-name>/index.ts` to ensure the interface compiler compiles cleanly.

---

## 3. Development Workflow for AI Assistants

### Local Native Module Structure
When creating or modifying native features, conform to this folder structure:
*   `modules/<module-name>/expo-module.config.json` — Specifies the package paths.
*   `modules/<module-name>/android/build.gradle` — Declares external Android dependencies (e.g. `okhttp3`).
*   `modules/<module-name>/android/src/...` — Houses Kotlin module classes.
*   `modules/<module-name>/index.ts` — Houses TypeScript wrappers.

### Compilation Command Reference
Before writing code, verify configuration integrity:
*   `npx expo prebuild --platform android --no-install` — Regenerates `/android` to check autolinking and config plugins.
*   `npx expo run:android` — Compiles the native codebase and boots the development server.

### Layout and Styling Constraints
*   **Do NOT use Tailwind `space-y-X` classes**: They are web-only CSS selectors (`child + child { margin-top }`) and are ignored on React Native views, squishing list layouts. Always use native flex layouts with inline `style={{ gap: X }}` or Tailwind `gap-X` properties.
*   **Do NOT use custom/extended text sizes**: Extended sizes like `text-2xs` or `text-3xs` fail to compile if not explicitly added in Tailwind configurations, defaulting to standard browser font sizes (16px) and clipping cards. Always use standard font sizes or explicit inline definitions (e.g. `text-[10px]`, `text-[9px]`).
*   **Use SVG for Blurs/Glows on Android**: React Native's CSS `blur-*` utility frequently crashes the hardware acceleration render-layer in Android when sibling `react-native-svg` components update. Always use mathematically perfect `<RadialGradient>` instances inside SVGs instead.

### Build & Release CI
*   **ABI Splitting & Universal APKs**: We use `plugins/withAbiSplits.js` to modify Android's `build.gradle` config during prebuild to ensure 4 distinct CPU-bound APKs are generated alongside 1 Universal APK to minimize file size.
*   **Version Sourcing**: Always dynamically import versions from `package.json` across TSX components (e.g., `import pkg from "../../../package.json"`) so versions stay synchronized with our GitHub Action (`release.yml`).
