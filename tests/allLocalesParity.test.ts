import { readdirSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';

const LOCALE_DIR = 'src/i18n/locales';

const flattenLeaves = (value: unknown, prefix = ''): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? { [prefix]: String(value ?? '') } : {};
  }
  return Object.entries(value).reduce<Record<string, string>>((leaves, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return { ...leaves, ...flattenLeaves(child, path) };
  }, {});
};

const interpolationTokens = (value: string): string[] => value.match(/\{\{[^}]+\}\}/g) ?? [];

const readLocale = async (code: string): Promise<Record<string, string>> =>
  flattenLeaves(await Bun.file(`${LOCALE_DIR}/${code}.json`).json());

const localeCodes = readdirSync(LOCALE_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length))
  .filter((code) => code !== 'en')
  .sort();

// Fork-only English keys are not translated upstream, so every shipped locale
// must carry them after an upstream merge adds or reshapes a locale.
describe('every locale covers the English keys', () => {
  test('finds the shipped locales', () => {
    expect(localeCodes.length).toBeGreaterThan(0);
  });

  for (const code of localeCodes) {
    test(`${code} has every English key with matching interpolation tokens`, async () => {
      const english = await readLocale('en');
      const locale = await readLocale(code);
      const missing = Object.keys(english).filter((key) => !(key in locale));
      const mismatches = Object.keys(english)
        .filter((key) => key in locale)
        .filter(
          (key) =>
            interpolationTokens(english[key]).sort().join('|') !==
            interpolationTokens(locale[key]).sort().join('|')
        );
      expect(missing).toEqual([]);
      expect(mismatches).toEqual([]);
    });
  }
});

