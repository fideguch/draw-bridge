/**
 * Level atlas entry (round-4 deliverable B) — the `npm run atlas` runnable.
 *
 * Thin side-effecting wrapper over the side-effect-free builder in ./atlas.ts
 * (importable by authoring.ts for the optional `--atlas` flag without triggering
 * a build). Regenerates .fable/atlas/index.html — a self-contained page showing
 * every level's route + coin placement + collection order.
 *
 * Run: `npm run atlas`  (or `vite-node scripts/atlas/build-atlas.ts`)
 */

import { buildAtlas } from './atlas';

const outPath = buildAtlas();
process.stderr.write(`atlas written: ${outPath}\n`);
