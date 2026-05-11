const {
  withAndroidManifest,
  AndroidConfig,
  withPlugins,
} = require("expo/config-plugins");

const TILE_SLOT_COUNT = 5;
const PACKAGE = "dev.faris.knockernative";

function ensureAttr(node, name, value) {
  node.$ = node.$ || {};
  node.$[name] = value;
}

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
                "android:name":
                  "android.service.quicksettings.action.QS_TILE",
              },
            },
          ],
        },
      ];
      // meta-data so the tile can be added to the active set without re-bind
      node["meta-data"] = [
        {
          $: {
            "android:name":
              "android.service.quicksettings.ACTIVE_TILE",
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
    if (!existingReceiver) application.receiver.push(receiverNode);

    return cfg;
  });
}

function withKnockerPermissions(config) {
  return AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.INTERNET",
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.USE_EXACT_ALARM",
  ]);
}

module.exports = function withKnockerNative(config) {
  return withPlugins(config, [withKnockerPermissions, withKnockerManifest]);
};
