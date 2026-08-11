import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import en from '@/i18n/locales/en.json';
import ru from '@/i18n/locales/ru.json';
import zhCN from '@/i18n/locales/zh-CN.json';
import zhTW from '@/i18n/locales/zh-TW.json';

type TranslationTree = Record<string, unknown>;

const ROOT = join(import.meta.dir, '..', 'src');
const TRANSLATION_KEY_PATTERN = /\bt\(\s*['"]([^'"]+)['"]/g;
const CJK_PATTERN = /[\u3400-\u9fff]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function translationKeys(): string[] {
  const keys = new Set<string>();
  for (const file of sourceFiles(ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(TRANSLATION_KEY_PATTERN)) {
      const key = match[1];
      if (key?.startsWith('config_management.')) keys.add(key);
    }
  }
  return [...keys].sort();
}

function hasTranslation(tree: TranslationTree, key: string): boolean {
  let current: unknown = tree;
  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object' || !(segment in current)) return false;
    current = (current as TranslationTree)[segment];
  }
  return typeof current === 'string' && current.trim().length > 0;
}

describe('Management Center i18n parity', () => {
  const keys = translationKeys();
  const locales = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ru };

  for (const [locale, translations] of Object.entries(locales)) {
    test(`${locale} defines every literal translation key`, () => {
      const missing = keys.filter((key) => !hasTranslation(translations, key));
      expect(missing).toEqual([]);
    });
  }

  test('fallbacks do not force Chinese text in other locales', () => {
    const offenders = sourceFiles(ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return source
        .split('\n')
        .map((line, index) => ({ file, line, lineNumber: index + 1 }))
        .filter(({ line }) => line.includes('defaultValue') && CJK_PATTERN.test(line));
    });
    expect(offenders).toEqual([]);
  });
});
