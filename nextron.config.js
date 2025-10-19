/**
 * Nextron Configuration
 * Custom webpack configuration to preserve class names in production build
 */

const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  webpack: (defaultConfig, env) => {
    // Only modify production builds
    if (env === 'production') {
      console.log('✓ [Nextron] Applying custom webpack configuration for production...');

      // Configure Terser to preserve class names and function names
      defaultConfig.optimization = defaultConfig.optimization || {};
      defaultConfig.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            keep_classnames: true,
            keep_fnames: true,
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.debug'],
            },
            mangle: {
              keep_classnames: true,
              keep_fnames: true,
            },
          },
          extractComments: false,
        }),
      ];

      console.log('✓ [Nextron] Webpack configured to preserve class names');
    }

    return defaultConfig;
  },
};
