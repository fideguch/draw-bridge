import { afterEach, describe, expect, it } from 'vitest';
import { MESSAGES, SUPPORTED_LOCALES, type MessageKey } from '@render/i18n/messages';
import { detectLocale, normalizeLocale, setLocale, t } from '@render/i18n';

const KEYS = Object.keys(MESSAGES.en) as MessageKey[];

afterEach(() => {
  setLocale('en'); // isolate: never leak a locale into the next test
});

describe('message catalog completeness', () => {
  it('ships every supported locale', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('every locale defines exactly the canonical key set (no gaps, no extras)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(MESSAGES[locale]).sort(), `locale ${locale}`).toEqual([...KEYS].sort());
    }
  });

  it('no message is blank in any locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of KEYS) {
        expect(MESSAGES[locale][key].length, `${locale}/${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('placeholders are preserved across every translation', () => {
    const placeholdersOf = (text: string) => (text.match(/\{[a-z]+\}/gi) ?? []).sort();
    for (const key of KEYS) {
      const canonical = placeholdersOf(MESSAGES.en[key]);
      for (const locale of SUPPORTED_LOCALES) {
        expect(placeholdersOf(MESSAGES[locale][key]), `${locale}/${key}`).toEqual(canonical);
      }
    }
  });
});

describe('normalizeLocale', () => {
  it('maps exact tags', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('ja')).toBe('ja');
    expect(normalizeLocale('ko')).toBe('ko');
    expect(normalizeLocale('th')).toBe('th');
    expect(normalizeLocale('vi')).toBe('vi');
  });

  it('maps region-qualified tags to the base locale', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('ja-JP')).toBe('ja');
    expect(normalizeLocale('ko-KR')).toBe('ko');
    expect(normalizeLocale('id-ID')).toBe('id');
  });

  it('folds every Chinese variant to Simplified (the only script shipped)', () => {
    expect(normalizeLocale('zh')).toBe('zh-Hans');
    expect(normalizeLocale('zh-CN')).toBe('zh-Hans');
    expect(normalizeLocale('zh-Hans')).toBe('zh-Hans');
    expect(normalizeLocale('zh-Hant')).toBe('zh-Hans');
    expect(normalizeLocale('zh-TW')).toBe('zh-Hans');
  });

  it('accepts the legacy Indonesian code "in"', () => {
    expect(normalizeLocale('in-ID')).toBe('id');
  });

  it('returns null for unsupported or empty tags', () => {
    expect(normalizeLocale('fr')).toBeNull();
    expect(normalizeLocale('de-DE')).toBeNull();
    expect(normalizeLocale('')).toBeNull();
  });
});

describe('detectLocale', () => {
  it('returns the first supported candidate', () => {
    expect(detectLocale(['fr-FR', 'ko-KR', 'en'])).toBe('ko');
  });

  it('falls back to English when nothing is supported', () => {
    expect(detectLocale(['fr-FR', 'de-DE'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('t', () => {
  it('returns the active locale string', () => {
    setLocale('ja');
    expect(t('result.clear')).toBe('クリア！');
    setLocale('ko');
    expect(t('result.clear')).toBe('클리어!');
  });

  it('interpolates named parameters', () => {
    setLocale('en');
    expect(t('settings.version', { version: '1.0.0' })).toBe('Version 1.0.0');
    expect(t('upgrade.effectNext', { pct: 20, nextPct: 30 })).toBe('Effect: +20% → Next Lv +30%');
  });

  it('preserves the reset word inside its hint', () => {
    setLocale('ja');
    expect(t('settings.resetTapHint', { word: t('settings.resetWord') })).toContain('リセット');
  });
});
