import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Path aliases MUST stay in sync with tsconfig.json "paths".
const alias = {
  '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
  '@render': fileURLToPath(new URL('./src/render', import.meta.url)),
  '@meta': fileURLToPath(new URL('./src/meta', import.meta.url)),
  '@platform': fileURLToPath(new URL('./src/platform', import.meta.url)),
  '@tuning': fileURLToPath(new URL('./src/tuning', import.meta.url)),
  // phaser-box2d@1.1.0 ships a broken "main" field ("index.js" does not exist);
  // the actual ESM entry is dist/PhaserBox2D.js. Aliased so the bare specifier works.
  'phaser-box2d': fileURLToPath(
    new URL('./node_modules/phaser-box2d/dist/PhaserBox2D.js', import.meta.url),
  ),
};

export default defineConfig({
  // Relative base so the bundle works from file:// inside the Capacitor WebView.
  base: './',
  resolve: { alias },
  server: {
    // Expose on LAN so real phones (portrait verification) can hit the dev server.
    host: true,
  },
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts', 'tests/contract/**/*.spec.ts'],
    coverage: {
      // Phase 2 checkpoint gate: unit coverage >= 80% on src/engine/ (tasks.md).
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
