/**
 * Shared helpers for the Gate 0-3 pipeline CLIs.
 * Contract: specs/001-inkbridge-mvp/contracts/gate-pipeline.md
 * Output discipline: stdout = NDJSON only; human logs -> stderr.
 * Exit codes: 0 all pass / 1 any level failed / 2 config-environment error.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export interface GateLine {
  gate: number;
  level: string;
  pass: boolean;
  errors: string[];
  durationMs: number;
  stateHash?: string;
  warnings?: string[];
}

export interface GateSummary {
  gate: number;
  summary: true;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
}

export const EXIT_PASS = 0;
export const EXIT_FAIL = 1;
export const EXIT_CONFIG = 2;

export interface CliOptions {
  levelsGlob: string;
  isQuiet: boolean;
}

/**
 * ROLLOUT FLAG (round-7, game_plan_v5 §3.6 rollout note). The three NEW size/span/
 * displacement gates are STRICT by default (a violation fails the build). CI passes
 * `--warn-new-gates` TEMPORARILY while the current 18 levels (authored before these
 * standards) are replaced by the 28-slate: in warn mode a new-gate violation is
 * demoted to a `warnings` entry and the level still passes. REMOVE the flag from CI
 * once the 28-slate lands so the gates enforce strictly again.
 */
export const WARN_NEW_GATES_FLAG = '--warn-new-gates';

/** True when the rollout flag is present (new size/span/displacement gates → warn). */
export function hasWarnNewGatesFlag(argv: readonly string[]): boolean {
  return argv.includes(WARN_NEW_GATES_FLAG);
}

/**
 * Demote a check result's errors to warnings when the rollout flag is set (see
 * WARN_NEW_GATES_FLAG). In warn mode the level passes (errors emptied) and each
 * violation is surfaced as a `WARN(deferred): ...` warning; in strict mode the
 * result passes through unchanged. Used only by the three round-7 gates.
 */
export function applyWarnMode(
  result: { errors: string[]; warnings?: string[] },
  warn: boolean,
): { errors: string[]; warnings?: string[] } {
  if (!warn || result.errors.length === 0) {
    return result;
  }
  const warnings = [...(result.warnings ?? []), ...result.errors.map((e) => `WARN(deferred): ${e}`)];
  return { errors: [], warnings };
}

export function parseCliOptions(argv: string[]): CliOptions {
  let levelsGlob = 'levels/*.json';
  let isQuiet = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--levels') {
      const next = argv[i + 1];
      if (!next) {
        process.stderr.write('gate: --levels requires a glob argument\n');
        process.exit(EXIT_CONFIG);
      }
      levelsGlob = next;
      i++;
    } else if (arg !== undefined && arg.startsWith('--levels=')) {
      levelsGlob = arg.slice('--levels='.length);
    } else if (arg === '--quiet') {
      isQuiet = true;
    }
  }
  return { levelsGlob, isQuiet };
}

/** Resolve a "<dir>/*.json" style glob without adding a dependency. */
export function resolveLevelFiles(glob: string): string[] {
  const dir = dirname(glob);
  const pattern = basename(glob);
  if (!pattern.includes('*')) {
    // Single file path.
    try {
      statSync(glob);
      return [glob];
    } catch {
      return [];
    }
  }
  const regex = new RegExp(
    '^' + pattern.split('*').map(escapeRegex).join('.*') + '$',
  );
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => regex.test(n))
    .sort()
    .map((n) => join(dir, n));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface LoadedLevelFile {
  file: string;
  /** Level id derived from filename (without .json) for reporting. */
  name: string;
  /** Parsed JSON or undefined when unreadable/unparseable. */
  json: unknown | undefined;
  readError?: string;
}

export function loadLevelFile(file: string): LoadedLevelFile {
  const name = basename(file).replace(/\.json$/, '');
  try {
    const raw = readFileSync(file, 'utf-8');
    return { file, name, json: JSON.parse(raw) as unknown };
  } catch (e) {
    return { file, name, json: undefined, readError: (e as Error).message };
  }
}

export function emit(line: GateLine | GateSummary, isQuiet: boolean): void {
  if (isQuiet && !('summary' in line)) return;
  process.stdout.write(JSON.stringify(line) + '\n');
}

/** Run a gate over level files and return the process exit code. */
export function runGate(
  gate: number,
  files: string[],
  isQuiet: boolean,
  checkLevel: (loaded: LoadedLevelFile) => { errors: string[]; stateHash?: string; warnings?: string[] },
): number {
  if (files.length === 0) {
    process.stderr.write(`gate${gate}: no level files matched\n`);
    return EXIT_CONFIG;
  }
  const started = Date.now();
  let passed = 0;
  let failed = 0;
  for (const file of files) {
    const levelStarted = Date.now();
    const loaded = loadLevelFile(file);
    let errors: string[];
    let stateHash: string | undefined;
    let warnings: string[] | undefined;
    if (loaded.json === undefined) {
      errors = [`unreadable: ${loaded.readError ?? 'unknown error'}`];
    } else {
      try {
        const result = checkLevel(loaded);
        errors = result.errors;
        stateHash = result.stateHash;
        warnings = result.warnings;
      } catch (e) {
        errors = [`gate crashed: ${(e as Error).message}`];
      }
    }
    const isPass = errors.length === 0;
    if (isPass) passed++;
    else failed++;
    const line: GateLine = {
      gate,
      level: loaded.name,
      pass: isPass,
      errors,
      durationMs: Date.now() - levelStarted,
    };
    if (stateHash !== undefined) line.stateHash = stateHash;
    if (warnings !== undefined && warnings.length > 0) line.warnings = warnings;
    emit(line, isQuiet);
  }
  emit(
    {
      gate,
      summary: true,
      total: files.length,
      passed,
      failed,
      durationMs: Date.now() - started,
    },
    false,
  );
  return failed > 0 ? EXIT_FAIL : EXIT_PASS;
}
