import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { emitProductionSeoAssets } from './src/seo/buildSeo';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, __dirname, '');
  if (!environment.VITE_SITE_URL) throw new Error('VITE_SITE_URL must be configured for production assets.');
  const siteUrl = new URL(environment.VITE_SITE_URL).toString().replace(/\/$/, '');
  const siteHost = new URL(siteUrl).hostname;
  if (mode === 'production' && !['localhost', '127.0.0.1'].includes(siteHost) && !siteUrl.startsWith('https://')) {
    throw new Error('VITE_SITE_URL must use HTTPS for production builds.');
  }
  return ({
  plugins: [
    react(),
    {
      name: 'emit-production-seo-assets',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist');
        emitProductionSeoAssets(distDir, siteUrl);
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    environment: 'jsdom',
    pool: 'threads',
  },
  });
});
