import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Dev-only device-stats sink (AC-9 gatekeeper evidence): SpikeScene on a real
 * device (loaded via LAN dev server with ?spike=1&report=1) POSTs its HUD
 * numbers here; they land in .fable/device-stats.jsonl for the orchestrator.
 */
function deviceStatsSink(): Plugin {
  return {
    name: 'inkbridge-device-stats-sink',
    configureServer(server) {
      server.middlewares.use('/__devicestats', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            mkdirSync('.fable', { recursive: true });
            appendFileSync('.fable/device-stats.jsonl', body.trim() + '\n');
          } catch {
            // evidence sink must never crash the dev server
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

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
  plugins: [deviceStatsSink()],
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
