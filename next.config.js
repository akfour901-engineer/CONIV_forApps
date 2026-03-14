// next.config.js
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force webpack instead of Turbopack (this is what you're using right now)
  experimental: {
    turbopack: false,
  },

  // Server-only external packages (kept from your config)
  serverExternalPackages: [
    "@genkit-ai/core",
    "genkit",
    "@genkit-ai/google-genai",
    "@grpc/grpc-js",
    "@opentelemetry/*",
    "firebase-admin",
    "google-auth-library",
    "gaxios",
    "@google-cloud/*",
  ],

  // Webpack config – only applies because we forced webpack
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side polyfills for Node.js built-ins
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        process: require.resolve('process/browser'),
      };

      // Provide process and Buffer globally in client bundle
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }

    return config;
  },

  // React strict mode (good default)
  reactStrictMode: true,

  // Remote image domains (your existing config)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },

  // Optional: faster standalone output for deployment
  // output: 'standalone',
};

module.exports = nextConfig;