const { withAppBuildGradle } = require('expo/config-plugins');

const withAndroidSigning = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const buildGradle = config.modResults.contents;
      
      const releaseSigningConfig = `
        release {
            if (System.getenv("KEYSTORE_BASE64") != null) {
                def keystoreFile = new File(projectDir, "keystore.jks")
                keystoreFile.withOutputStream { it.write(System.getenv("KEYSTORE_BASE64").decodeBase64()) }
                storeFile keystoreFile
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD")
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

      if (!buildGradle.includes('KEYSTORE_BASE64')) {
        if (buildGradle.includes('signingConfigs {')) {
          config.modResults.contents = buildGradle.replace(
            /signingConfigs\s*\{/,
            'signingConfigs {' + releaseSigningConfig
          );
        } else {
          config.modResults.contents = buildGradle.replace(
            /buildTypes\s*\{/,
            '    signingConfigs {' + releaseSigningConfig + '\n    }\n\n    buildTypes {'
          );
        }
      }
      
      config.modResults.contents = config.modResults.contents.replace(
        /release\s*\{\n(.*?)signingConfig signingConfigs\.debug/s,
        'release {\n$1signingConfig signingConfigs.release'
      );
      
      if (!config.modResults.contents.includes('signingConfig signingConfigs.release')) {
          config.modResults.contents = config.modResults.contents.replace(
            /release\s*\{/,
            'release {\n            signingConfig signingConfigs.release'
          );
      }
    }
    return config;
  });
};

module.exports = withAndroidSigning;
