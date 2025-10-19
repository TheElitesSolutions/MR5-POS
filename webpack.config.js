/**
 * Custom Webpack Configuration for Nextron
 * Preserves class names in production build for service registry
 */

const TerserPlugin = require('terser-webpack-plugin');

module.exports = function (config, env) {
  // Only modify production builds
  if (env === 'production') {
    // Ensure optimization exists
    config.optimization = config.optimization || {};

    // Configure Terser to keep class names
    config.optimization.minimizer = [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true,
          compress: {
            drop_console: false, // Keep console logs for debugging
          },
          mangle: {
            keep_classnames: true,
            keep_fnames: true,
          },
        },
        extractComments: false,
      }),
    ];

    console.log('✓ Webpack configured to preserve class names in production build');
  }

  return config;
};
