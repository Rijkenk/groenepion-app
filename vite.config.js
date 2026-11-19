import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// De app draait op https://rijkenk.github.io/groenepion-app/ (GitHub Pages).
// De build komt in /docs, zodat Pages die map vanaf de main-branch kan serveren.
export default defineConfig(({ mode }) => ({
  base: process.env.GP_BASE || '/groenepion-app/',
  plugins: [preact()],
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'docs', emptyOutDir: true },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
}));
