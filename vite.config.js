import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        // Added the new advanced dashboard to the build process
        dashboardPro: resolve(__dirname, 'dashboard-pro.html'),
      },
    },
  },
});

