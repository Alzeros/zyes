import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// During dev the Vite frontend proxies /api to whichever backend you're running:
//   NODE backend  (Fastify, port 3847)     -> default
//   WORKER backend (wrangler dev, port 8787) -> set VITE_API_TARGET=http://127.0.0.1:8787
// Pass mode via env: `VITE_API_TARGET=http://127.0.0.1:8787 npm run dev:client`
export default defineConfig(({ mode }) => {
  // loadEnv picks up VITE_API_TARGET from .env / .env.local / process.env
  loadEnv(mode ?? 'development', process.cwd(), '');
  const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3847';
  return {
    plugins: [svelte(), tailwindcss()],
    root: 'src',
    build: {
      outDir: '../dist/client',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
