const { withProjectBuildGradle } = require('expo/config-plugins');

const withAndroidDisableLint = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const buildGradle = config.modResults.contents;
      
      const disableLintConfig = `
subprojects {
    tasks.whenTaskAdded { task ->
        if (task.name.startsWith("lint")) {
            task.enabled = false
        }
    }
}
`;
      if (!buildGradle.includes('task.name.startsWith("lint")')) {
        config.modResults.contents = buildGradle + '\n' + disableLintConfig;
      }
    }
    return config;
  });
};

module.exports = withAndroidDisableLint;
