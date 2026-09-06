import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// This prototype exports static files; it does not require a Worker runtime.
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext()],
  server: {proxy: {'/api': {target: 'http://127.0.0.1:3001', changeOrigin: false}}},
});
