# Contributing to NetPilot

First off, thank you for considering contributing to NetPilot! It's people like you that make NetPilot such a great tool for network diagnostics.

## Development Setup

NetPilot is built on a hybrid architecture combining React Native Expo (SDK 57) and Custom Local Kotlin Modules.

### Prerequisites

- Node.js (v18+)
- Yarn
- Java Development Kit (JDK 17)
- Android SDK (command-line tools, platform-tools, build-tools)
- Android Studio (optional, but highly recommended for testing Kotlin modules)

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/mdasifj625/netpilot.git
   cd netpilot
   ```

2. Install JavaScript dependencies:
   ```bash
   yarn install
   ```

3. Generate the native Android folder:
   ```bash
   yarn prebuild
   ```
   *Note: The `/android` folder is generated dynamically. Any manual changes made in `/android` will be permanently lost on the next prebuild. Always write Expo Config Plugins (under `/plugins/`) to inject modifications, or modify Kotlin code in `/modules/`.*

4. Start the development server and compile the native codebase:
   ```bash
   yarn android
   ```

## UI & State Architecture (MVVM)

NetPilot uses a strict Model-View-ViewModel (MVVM) architecture for its React Native frontend to maintain a clean separation of concerns:
- **Views (`src/app/`)**: Screen files should strictly handle routing and declarative UI composition. No heavy business logic or state mutations should exist here.
- **ViewModels (`src/features/*/use*ViewModel.ts`)**: All state, native module listeners, sensor polling, and business logic are contained in dedicated hooks (e.g., `useSpeedViewModel`, `useWifiViewModel`).
- **Components (`src/features/*/components/`)**: Visual elements (like gauge charts, signal meters, and custom cards) are extracted into reusable stateless (or localized state) UI components.

When building new UI features, please adhere to this pattern by creating the corresponding feature folder under `src/features/`.

## Release Pipeline & CI/CD

NetPilot uses GitHub Actions to automate its release pipeline. 
- The `.github/workflows/release.yml` workflow triggers on `v*` tags.
- It dynamically reads the app version from `package.json`.
- It uses the custom `plugins/withAbiSplits.js` to patch Android's `build.gradle` to compile **5 specific APKs** (Universal, `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`) to minimize individual download sizes.

## Modifying Native Modules

NetPilot uses custom local Kotlin modules inside the `/modules/` directory mapped via the Expo Modules API.

- `modules/<module-name>/android/src/...` houses Kotlin module classes.
- For complex logic (e.g. ICMP ping sweeps, HTTP speed tests), extract the implementation into `.../utils/` helper classes to keep the main `Module` class clean.
- `modules/<module-name>/index.ts` houses TypeScript wrappers.

If you add new native methods, ensure you update the corresponding TypeScript exports to compile cleanly.

## Code Quality and Pull Requests

Before submitting a Pull Request, please ensure your code passes all linting and type checks:

```bash
yarn lint
yarn format
```

### Submitting a Pull Request
1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
