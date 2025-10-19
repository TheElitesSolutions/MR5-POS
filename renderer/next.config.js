const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // CRITICAL: Static export for Electron
  output: 'export',

  // CRITICAL: Correct distDir for Nextron structure
  distDir: process.env.NODE_ENV === 'production' ? '../app' : '.next',

  // Trailing slash for better Electron routing
  trailingSlash: true,
  skipTrailingSlashRedirect: true,

  // Allow builds to pass even if ESLint/TS finds issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow builds with type errors during migration
    ignoreBuildErrors: true,
  },

  // CRITICAL: Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Remove powered by header
  poweredByHeader: false,

  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  experimental: {
    // Disable optimizeCss to avoid critters dependency issue in Electron builds
    // optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Headers configuration for CSP compatibility
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:*;",
          },
        ],
      },
    ];
  },

  // Bundle optimization
  webpack: (config, { isServer, dev }) => {
    // Add aliases for path resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '.'),
      '@/components': path.resolve(__dirname, './components'),
      '@/stores': path.resolve(__dirname, './stores'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/utils': path.resolve(__dirname, './utils'),
      '@/types': path.resolve(__dirname, './types'),
      '@/services': path.resolve(__dirname, './services'),
    };

    // CRITICAL: Handle Node.js built-in modules for browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
        http: false,
        https: false,
        child_process: false,
        util: false,
        tty: false,
        net: false,
        assert: false,
        electron: false, // CRITICAL: Prevent electron in renderer bundle
      };
    }

    // Bundle optimization configurations
    if (!dev && !isServer) {
      // Split chunks for better caching
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              chunks: 'all',
              enforce: true,
            },
            ui: {
              name: 'ui',
              test: /[\\/]components[\\/]ui[\\/]/,
              chunks: 'all',
              enforce: true,
            },
            stores: {
              name: 'stores',
              test: /[\\/]stores[\\/]/,
              chunks: 'all',
              enforce: true,
            },
          },
        },
      };

      // Tree shaking optimizations
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Bundle analyzer (only in development when ANALYZE=true)
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          analyzerPort: 8888,
          openAnalyzer: true,
        })
      );
    }

    return config;
  },
};

module.exports = nextConfig;