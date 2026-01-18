const { withAndroidManifest } = require('@expo/config-plugins');

// Plugin to add FLAG_SECURE to VaultScreen for screenshot protection
module.exports = function withVaultScreenshotProtection(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Note: FLAG_SECURE needs to be set programmatically in the Activity
    // This plugin structure is here for future native module implementation
    // For now, screenshot protection is handled in VaultScreen component
    
    return config;
  });
};

