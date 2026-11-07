const { withAppBuildGradle } = require('expo/config-plugins');

/** Configure upload signing in regenerated Android projects without persisting credentials. */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents += `
// Release credentials are supplied only by the build environment, never written here.
if (System.getenv("KNOCKER_SIGN_RELEASE") == "true") {
    def required = ["KNOCKER_KEYSTORE_PATH", "STORE_PASSWORD", "KEY_ALIAS", "KEY_PASSWORD"]
    required.each { key ->
        if (!System.getenv(key)) throw new GradleException("Missing signing variable: " + key)
    }
    android.signingConfigs.create("upload") {
        storeFile file(System.getenv("KNOCKER_KEYSTORE_PATH"))
        storePassword System.getenv("STORE_PASSWORD")
        keyAlias System.getenv("KEY_ALIAS")
        keyPassword System.getenv("KEY_PASSWORD")
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.upload
} else if (System.getenv("CI") == "true" && System.getenv("KNOCKER_ALLOW_DEBUG_SIGNING") != "true") {
    gradle.taskGraph.whenReady { graph ->
        if (graph.allTasks.any { it.project.path == ":app" && it.name.contains("Release") }) {
            throw new GradleException("CI release signing must be explicitly configured")
        }
    }
}
`;
    return config;
  });
};
