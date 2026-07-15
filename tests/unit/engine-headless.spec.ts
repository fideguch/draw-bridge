import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Engine headless guard (constitution IV, conventions §1): src/engine/ must
 * run in plain Node — no Phaser, and nothing from render/meta/platform.
 * ESLint boundaries enforces this at lint time; this test keeps the guarantee
 * inside the unit suite too (grep-style check over every engine source file).
 *
 * phaser-box2d IS allowed: it is the physics library and, despite the name,
 * has no dependency on Phaser itself.
 */

const ENGINE_DIR = join(__dirname, '..', '..', 'src', 'engine');

function listTsFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFilesRecursively(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Exact module specifier 'phaser' (quoted) — does NOT match 'phaser-box2d'.
const PHASER_SPECIFIER = /['"]phaser['"]/;
const FORBIDDEN_LAYER_SPECIFIER = /['"](@render|@meta|@platform)[/'"]|from\s+['"]\.\.?\/(?:\.\.\/)*(render|meta|platform)\//;

describe('engine headless guard', () => {
  const engineFiles = listTsFilesRecursively(ENGINE_DIR);

  it('finds engine source files to check', () => {
    expect(engineFiles.length).toBeGreaterThan(0);
  });

  it.each(engineFiles.map((file) => [file.slice(ENGINE_DIR.length + 1), file]))(
    'src/engine/%s never imports phaser or render/meta/platform',
    (_relative, fullPath) => {
      const source = readFileSync(fullPath, 'utf8');
      expect(source).not.toMatch(PHASER_SPECIFIER);
      expect(source).not.toMatch(FORBIDDEN_LAYER_SPECIFIER);
    },
  );
});
