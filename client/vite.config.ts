import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  server: {
    middlewareMode: true,
  },
  build: {
    outDir: path.resolve(__dirname, './dist'),
    emptyOutDir: true,
    // Sourcemaps are memory-heavy to emit and the Databricks Apps build
    // container is memory-constrained, so never emit them for production.
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split the large vendor libraries into their own chunks so no single
        // chunk dominates the bundle and peak build memory stays lower.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('echarts') || id.includes('zrender')) return 'charts';
          if (id.includes('apache-arrow')) return 'arrow';
          if (id.includes('react-router')) return 'router';
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/'))
            return 'react-vendor';
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-dev-runtime', 'react/jsx-runtime'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
