import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { WeightRobinQueuePage, authDisplayName } from '@/pages/WeightRobinQueuePage';

describe('authDisplayName', () => {
  test('prefixes provider for plain oauth emails', () => {
    expect(authDisplayName('zai', 'jc81rho@gmail.com')).toBe('zai:jc81rho@gmail.com');
  });

  test('keeps apikey names that already carry the provider prefix', () => {
    expect(authDisplayName('commandcode', 'commandcode-apikey')).toBe('commandcode-apikey');
    expect(authDisplayName('commandcode', 'commandcode:primary')).toBe('commandcode:primary');
  });

  test('falls back to whichever side exists', () => {
    expect(authDisplayName('', 'solo')).toBe('solo');
    expect(authDisplayName('prov', '')).toBe('prov');
  });
});

describe('WeightRobinQueuePage rendering', () => {
  // bun test shares one i18n instance across files; pin English instead of
  // relying on whichever language another file left behind.
  let originalLanguage = i18n.language;
  beforeAll(async () => {
    originalLanguage = i18n.language;
    await i18n.changeLanguage('en');
  });
  afterAll(async () => {
    await i18n.changeLanguage(originalLanguage);
  });

  test('renders page shell without router errors', () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(WeightRobinQueuePage))
    );
    expect(markup).toContain('Weight-Robin Queue');
  });
});
