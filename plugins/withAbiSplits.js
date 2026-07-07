const { withAppBuildGradle } = require('@expo/config-plugins');

const withAbiSplits = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const splitConfig = `
    splits {
        abi {
            reset()
            enable true
            universalApk true
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }`;
      
      // Inject ABI splits into the android block if not already present
      if (!config.modResults.contents.includes("splits {")) {
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*\{/,
          `android {${splitConfig}`
        );
      }
    }
    return config;
  });
};

module.exports = withAbiSplits;
