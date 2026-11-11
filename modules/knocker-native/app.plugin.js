const {
  withAndroidManifest,
  AndroidConfig,
  withDangerousMod,
  withPlugins,
} = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

const TILE_SLOT_COUNT = 5;
const PACKAGE = "dev.faris.knockernative";

/** Adds or replaces a manifest attribute while preserving the other attributes. */
function ensureAttr(node, name, value) {
  node.$ = node.$ || {};
  node.$[name] = value;
}

/** Installs the five tile services and private renewal receiver idempotently during prebuild. */
function withKnockerManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const application =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    application.service = application.service || [];
    application.receiver = application.receiver || [];

    // Quick Settings tile services (one per pinned slot).
    for (let slot = 1; slot <= TILE_SLOT_COUNT; slot++) {
      const name = `${PACKAGE}.KnockerTileService${slot}`;
      const existing = application.service.find(
        (s) => s.$ && s.$["android:name"] === name,
      );
      const node = existing || {};
      ensureAttr(node, "android:name", name);
      ensureAttr(node, "android:label", `Knock ${slot}`);
      ensureAttr(node, "android:icon", "@drawable/ic_tile_knocker");
      ensureAttr(
        node,
        "android:permission",
        "android.permission.BIND_QUICK_SETTINGS_TILE",
      );
      ensureAttr(node, "android:exported", "true");
      node["intent-filter"] = [
        {
          action: [
            {
              $: {
                "android:name": "android.service.quicksettings.action.QS_TILE",
              },
            },
          ],
        },
      ];
      // meta-data so the tile can be added to the active set without re-bind
      node["meta-data"] = [
        {
          $: {
            "android:name": "android.service.quicksettings.ACTIVE_TILE",
            "android:value": "true",
          },
        },
      ];
      if (!existing) application.service.push(node);
    }

    // AlarmManager renewal receiver (in-app process; not exported).
    const receiverName = `${PACKAGE}.RenewAlarmReceiver`;
    const existingReceiver = application.receiver.find(
      (r) => r.$ && r.$["android:name"] === receiverName,
    );
    const receiverNode = existingReceiver || {};
    ensureAttr(receiverNode, "android:name", receiverName);
    ensureAttr(receiverNode, "android:exported", "false");
    receiverNode["intent-filter"] = [
      {
        action: [
          {
            $: {
              "android:name":
                "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED",
            },
          },
        ],
      },
    ];
    if (!existingReceiver) application.receiver.push(receiverNode);

    const networkReceiver = `${PACKAGE}.NetworkChangeReceiver`;
    if (
      !application.receiver.some(
        (r) => r.$?.["android:name"] === networkReceiver,
      )
    ) {
      application.receiver.push({
        $: { "android:name": networkReceiver, "android:exported": "false" },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
            ],
          },
        ],
      });
    }
    return cfg;
  });
}

/** Requests user-granted alarm access without the restricted automatic grant. */
function withKnockerPermissions(config) {
  return AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.SCHEDULE_EXACT_ALARM",
  ]);
}

/** Adds the local-module lint exception without replacing existing lint configuration. */
function withKnockerLint(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const lintPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "lint.xml",
      );
      let contents;
      try {
        contents = await fs.readFile(lintPath, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        contents = '<?xml version="1.0" encoding="UTF-8"?>\n<lint>\n</lint>\n';
      }

      if (!contents.includes('id="Instantiatable"')) {
        if (!contents.includes("</lint>")) {
          throw new Error(
            `Cannot update malformed Android lint config: ${lintPath}`,
          );
        }
        contents = contents.replace(
          "</lint>",
          '  <!-- Expo/local-module components are compiled separately from the app lint model. -->\n  <issue id="Instantiatable" severity="ignore" />\n</lint>',
        );
        await fs.writeFile(lintPath, contents);
      }

      return cfg;
    },
  ]);
}

module.exports = function withKnockerNative(config) {
  return withPlugins(config, [
    withKnockerPermissions,
    withKnockerManifest,
    withKnockerLint,
  ]);
};
