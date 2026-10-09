import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { quasar } from '@quasar/vite-plugin';

const pastaWeb = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(pastaWeb, '..');

// GitHub Pages (site de projeto): VITE_BASE=/nome-do-repo/
export default defineConfig({
  root: raiz,
  base: process.env.VITE_BASE || '/',
  publicDir: path.join(pastaWeb, 'public'),
  plugins: [vue(), quasar()],
  build: {
    outDir: path.join(pastaWeb, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
