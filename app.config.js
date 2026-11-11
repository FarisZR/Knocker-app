const base = require('./app.json').expo;

/** Resolve validated release versions before Expo generates the native project. */
module.exports = () => {
  const version = process.env.KNOCKER_VERSION_NAME || base.version;
  const versionCode = Number(process.env.KNOCKER_VERSION_CODE || 1);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('KNOCKER_VERSION_NAME must be a semantic version');
  }
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('KNOCKER_VERSION_CODE must be a positive Play-compatible integer');
  }
  return {
    ...base,
    version,
    android: { ...base.android, versionCode },
    plugins: [...base.plugins, './scripts/withReleaseSigning'],
  };
};
