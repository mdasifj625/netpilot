const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidBackgroundService(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ensure <application> exists
    if (!androidManifest.manifest.application || !androidManifest.manifest.application[0]) {
      throw new Error("AndroidManifest.xml application tag not found.");
    }
    
    const mainApplication = androidManifest.manifest.application[0];

    // Ensure application service array exists
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    // Register our background service class name
    const serviceName = "com.superhero.netpilot.cellular.BackgroundService";
    
    const hasService = mainApplication.service.some(
      (s) => s.$ && s.$["android:name"] === serviceName
    );

    if (!hasService) {
      mainApplication.service.push({
        $: {
          "android:name": serviceName,
          "android:foregroundServiceType": "location|specialUse",
          "android:enabled": "true",
          "android:exported": "false",
        },
      });
      console.log(`ConfigPlugin: Injected <service android:name="${serviceName}" ... /> into AndroidManifest.xml`);
    }

    return config;
  });
};
