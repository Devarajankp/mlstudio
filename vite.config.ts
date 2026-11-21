import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// base './' keeps every asset URL relative, so the same build works on Vercel,
// from a sub-path, and later inside a desktop (Electron/Tauri) shell.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __REPO__: JSON.stringify(process.env.GITHUB_REPOSITORY ?? ''),
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1200 },
});
