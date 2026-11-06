const { withAppBuildGradle } = require("expo/config-plugins");

// Gradle's daemon working directory is not guaranteed to be the app's directory.
// Anchor Sentry's Node package lookup to the generated Android project instead.
module.exports = function withMonorepoSentry(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /^(apply from:.*@sentry\/react-native\/package\.json.*)\.execute\(\)/m,
      "$1.execute(null, rootDir)",
    );
    return config;
  });
};
