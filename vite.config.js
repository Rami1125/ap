import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        // הוספנו את קובץ לוח הבקרה המתקדם לתהליך הבנייה
        dashboardPro: resolve(__dirname, 'dashboard-pro.html')
      },
    },
  },
});
