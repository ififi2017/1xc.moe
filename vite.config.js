import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js alone is ~600 kB minified (≈160 kB gzipped); that's expected here
    chunkSizeWarningLimit: 800,
  },
});
