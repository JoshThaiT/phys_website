import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // `pnpm dev` proxies /api to `vercel dev` so local matches production.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
