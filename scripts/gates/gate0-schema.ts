/**
 * Gate 0 — level JSON schema + code-level checks.
 * Contract: specs/001-inkbridge-mvp/contracts/gate-pipeline.md §1
 * Delegates to the engine's validateLevel (single source of truth shared with
 * the game and the editor) and adds the filename<->id match check.
 */
import { validateLevel } from '../../src/engine/level/LevelSchema';
import { parseCliOptions, resolveLevelFiles, runGate } from './lib';

export function gate0Check(loaded: { name: string; json: unknown }): { errors: string[] } {
  const errors: string[] = [];
  const result = validateLevel(loaded.json);
  if (!result.ok) {
    errors.push(...result.errors);
    return { errors };
  }
  if (result.level.id !== loaded.name) {
    errors.push(`filename/id mismatch: file "${loaded.name}.json" contains id "${result.level.id}"`);
  }
  return { errors };
}

export function runGate0(argv: string[]): number {
  const { levelsGlob, isQuiet } = parseCliOptions(argv);
  const files = resolveLevelFiles(levelsGlob);
  return runGate(0, files, isQuiet, gate0Check);
}

// vite-node strips the script path from argv, so entry detection is impossible;
// this file is a CLI (top-level execution). The runner invokes it as a child process.
process.exit(runGate0(process.argv.slice(2)));
