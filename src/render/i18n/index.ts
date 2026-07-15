/**
 * i18n (render layer) — device-locale-driven UI strings.
 *
 * The active locale follows the device: `detectLocale()` reads
 * `navigator.languages` (the BCP-47 tags the OS exposes to the WebView) and maps
 * the first supported match; anything unsupported falls back to English. There
 * is no in-app language switch — "follow system settings" is the whole contract.
 *
 * The Engine is Phaser-free AND locale-free (constitution); i18n lives only here
 * in render. `t()` resolves the locale lazily on first use, so no explicit init
 * is required, and `setLocale()` exists for deterministic tests.
 */

import { MESSAGES, SUPPORTED_LOCALES, type Locale, type MessageKey } from './messages';

export { SUPPORTED_LOCALES, type Locale, type MessageKey };

const DEFAULT_LOCALE: Locale = 'en';

/** Base-language → shipped locale. `zh-*` is handled ahead of this map. */
const BASE_TO_LOCALE: Readonly<Record<string, Locale>> = {
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  id: 'id',
  in: 'id', // legacy ISO code some platforms still emit for Indonesian
  vi: 'vi',
  th: 'th',
};

let activeLocale: Locale | null = null;

/**
 * Map a single BCP-47 language tag to a shipped locale, or null when none fits.
 * All Chinese variants (zh-Hans/zh-Hant/zh-TW/zh-HK/zh) resolve to Simplified —
 * the only Chinese script we ship.
 */
export function normalizeLocale(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase();
  if (lower === '') return null;
  if (lower === 'zh' || lower.startsWith('zh-') || lower.startsWith('zh_')) return 'zh-Hans';
  const base = lower.split(/[-_]/)[0] ?? '';
  return BASE_TO_LOCALE[base] ?? null;
}

/**
 * Resolve the device locale from an ordered candidate list (defaults to
 * `navigator.languages`). Returns the first supported match, else English.
 */
export function detectLocale(candidates?: readonly string[]): Locale {
  const tags =
    candidates ??
    (typeof navigator !== 'undefined'
      ? navigator.languages !== undefined && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language]
      : []);
  for (const tag of tags) {
    const match = normalizeLocale(tag ?? '');
    if (match !== null) return match;
  }
  return DEFAULT_LOCALE;
}

/** Force a locale (tests, or a future explicit override). */
export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

/** The active locale, resolved from the device on first access. */
export function getLocale(): Locale {
  if (activeLocale === null) activeLocale = detectLocale();
  return activeLocale;
}

/**
 * Translate `key` for the active locale, interpolating `{name}` placeholders
 * from `params`. Falls back to English, then to the raw key, so a gap never
 * renders blank.
 */
export function t(key: MessageKey, params?: Readonly<Record<string, string | number>>): string {
  const catalog = MESSAGES[getLocale()];
  let text = catalog[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
