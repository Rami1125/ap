import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // This is now the single entry point for the entire application
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});

