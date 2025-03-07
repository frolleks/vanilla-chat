import { defineConfig } from 'vite';
import { sync } from 'glob';

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: sync('./src/**/*.html'.replace(/\\/g, '/')),
    },
  },
});
