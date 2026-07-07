/**
 * Gate pipeline runner — executes Gates 0 -> 1 -> 2 -> 3 in order over all
 * levels, does NOT stop at the first failing gate (full report per PR).
 * Contract: specs/001-inkbridge-mvp/contracts/gate-pipeline.md §2.
 * Exit: 0 all gates pass / 1 any gate failed / 2 config error (including
 * a missing gate script — the pipeline is all-or-nothing by design).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { EXIT_CONFIG, EXIT_FAIL, EXIT_PASS } from './lib';

const GATE_SCRIPTS = [
  'gate0-schema.ts',
  'gate1-static.ts',
  'gate2-ghost.ts',
  'gate3-antidominant.ts',
];

const gatesDir = join(process.cwd(), 'scripts', 'gates');
const viteNodeBin = join(process.cwd(), 'node_modules', '.bin', 'vite-node');
const forwardedArgs = process.argv.slice(2).filter((a) => a !== '--');

let worstExit = EXIT_PASS;

for (const script of GATE_SCRIPTS) {
  const scriptPath = join(gatesDir, script);
  if (!existsSync(scriptPath)) {
    process.stderr.write(`run-gates: missing gate script ${script} — pipeline incomplete\n`);
    worstExit = EXIT_CONFIG;
    continue;
  }
  const result = spawnSync(viteNodeBin, [scriptPath, '--', ...forwardedArgs], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const code = result.status ?? EXIT_CONFIG;
  if (code === EXIT_CONFIG) worstExit = EXIT_CONFIG;
  else if (code === EXIT_FAIL && worstExit !== EXIT_CONFIG) worstExit = EXIT_FAIL;
}

process.exit(worstExit);
