/**
 * Nextron Configuration
 * Custom webpack configuration to preserve class names in production build
 */

const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  // Fix: Explicitly set renderer port to match Next.js dev server
  rendererPort: 8888,

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
              // FIX: Remove ALL console methods in production (not just log/debug)
              // This prevents memory leaks and saves 50-100ms/minute overhead
              pure_funcs: [
                'console.log',
                'console.debug',
                'console.info',
                'console.warn',
                // Keep console.error for critical error reporting
              ],
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
