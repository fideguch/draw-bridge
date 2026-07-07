import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

/**
 * ESLint flat config (T003).
 * - Naming: .specify/memory/conventions.md §2
 * - Layer boundaries: conventions.md §1 (constitution IV) via eslint-plugin-boundaries v7
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'ios/**',
      'android/**',
      '.husky/**',
      'coverage/**',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // conventions.md §2 — naming
      '@typescript-eslint/naming-convention': [
        'error',
        // default: camelCase (leading underscore allowed for intentionally unused)
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
        // Classes/types/interfaces: PascalCase
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        // No `I` prefix on interfaces
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false,
          },
        },
        // Booleans: is/has/should prefix
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'should'],
        },
        // Variables: camelCase; UPPER_SNAKE only for true compile-time constants
        {
          selector: 'variable',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        // Properties: camelCase (level JSON / tuning) + snake_case (frozen GA4 vocabulary)
        {
          selector: ['objectLiteralProperty', 'typeProperty'],
          format: ['camelCase', 'snake_case'],
        },
        // Quoted keys (path aliases, package names) are exempt
        {
          selector: ['objectLiteralProperty', 'typeProperty'],
          modifiers: ['requiresQuotes'],
          format: null,
        },
        {
          selector: 'enumMember',
          format: ['PascalCase', 'UPPER_CASE'],
        },
      ],
    },
  },
  // Layer boundaries — src only (conventions.md §1)
  {
    files: ['src/**/*.ts'],
    plugins: {
      boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      'boundaries/include': ['src/**/*'],
      // First matching descriptor wins (impl subdirs before the interfaces bucket).
      'boundaries/elements-single-type': true,
      'boundaries/elements': [
        {
          type: 'platform-impl',
          pattern: 'src/platform/(noop|web|capacitor)',
          capture: ['impl'],
        },
        { type: 'platform-interfaces', pattern: 'src/platform' },
        { type: 'engine', pattern: 'src/engine' },
        { type: 'render', pattern: 'src/render' },
        { type: 'meta', pattern: 'src/meta' },
        { type: 'tuning', pattern: 'src/tuning' },
        { type: 'editor', pattern: 'src/editor' },
        { type: 'debug', pattern: 'src/debug' },
        // NOTE: src/main.ts (composition root) and src/types/ (ambient decls) are
        // intentionally element-free: nothing may import main.ts, and imports FROM
        // unknown files are not constrained (main.ts wires every layer together).
      ],
    },
    rules: {
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // engine imports only engine + tuning (Phaser-free, headless)
            {
              from: { element: { types: 'engine' } },
              allow: { to: { element: { types: { anyOf: ['engine', 'tuning'] } } } },
            },
            // render/meta observe engine, read tuning, talk to platform via interfaces
            {
              from: { element: { types: 'render' } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ['render', 'engine', 'tuning', 'platform-interfaces'] },
                  },
                },
              },
            },
            {
              from: { element: { types: 'meta' } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ['meta', 'engine', 'tuning', 'platform-interfaces'] },
                  },
                },
              },
            },
            // platform impls (noop/web/capacitor) implement the interfaces only;
            // helpers within the SAME impl subdir allowed, cross-impl imports are not
            {
              from: { element: { types: 'platform-impl' } },
              allow: { to: { element: { types: 'platform-interfaces' } } },
            },
            {
              from: { element: { types: 'platform-impl' } },
              allow: {
                to: {
                  element: {
                    types: 'platform-impl',
                    captured: { impl: '{{ from.captured.impl }}' },
                  },
                },
              },
            },
            {
              from: { element: { types: 'platform-interfaces' } },
              allow: {
                to: { element: { types: { anyOf: ['platform-interfaces', 'tuning'] } } },
              },
            },
            { from: { element: { types: 'tuning' } }, allow: { to: { element: { types: 'tuning' } } } },
            // dev-only tools: anything except platform impl subdirs
            {
              from: { element: { types: { anyOf: ['editor', 'debug'] } } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: [
                        'editor',
                        'debug',
                        'engine',
                        'render',
                        'meta',
                        'tuning',
                        'platform-interfaces',
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
);
