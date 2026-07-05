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

## Modifying Native Modules

NetPilot uses custom local Kotlin modules inside the `/modules/` directory mapped via the Expo Modules API.

- `modules/<module-name>/android/src/...` houses Kotlin module classes.
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
