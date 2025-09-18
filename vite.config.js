import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // This tells Vite to copy everything from the 'public' folder to the build output
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        dashboardPro: resolve(__dirname, 'dashboard-pro.html'),
        adm: resolve(__dirname, 'adm.html')
      },
    },
  },
});

