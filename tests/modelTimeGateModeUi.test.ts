import { describe, expect, test } from 'bun:test';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import { parse as parseYaml } from 'yaml';
import { useVisualConfig } from '../src/hooks/useVisualConfig';
import { ModelTimeGatesEditor } from '../src/components/config/VisualConfigEditorBlocks';
import en from '../src/i18n/locales/en.json';

function unwrapPre(markup: string): string {
  return markup.slice('<pre>'.length, -'</pre>'.length);
}

const i18n = createInstance();
await i18n.init({ lng: 'en', resources: { en: { translation: en } } });

describe('model time gate mode round-trip', () => {
  test('loads mode:allow from YAML and writes it back', () => {
    function Harness() {
      const visualConfig = useVisualConfig();
      const [phase, setPhase] = useState(0);

      if (phase === 0) {
        visualConfig.loadVisualValuesFromYaml(
          'routing:\n  model-time-gates:\n    - name: whitelist\n      schedule: "0 1 * * 1-5"\n      duration: 3h\n      mode: allow\n      models:\n        - deepseek-v3.2\n'
        );
        setPhase(1);
        return null;
      }

      if (phase === 1) {
        return createElement(
          'pre',
          null,
          `${visualConfig.visualValues.modelTimeGates[0]?.mode ?? 'none'}\n---\n${visualConfig.applyVisualChangesToYaml(
            'routing:\n  model-time-gates:\n    - name: whitelist\n      schedule: "0 1 * * 1-5"\n      duration: 3h\n      mode: allow\n      models:\n        - deepseek-v3.2\n'
          )}`
        );
      }

      return null;
    }

    const markup = renderToStaticMarkup(createElement(Harness));
    const [mode, yamlText] = unwrapPre(markup).split('\n---\n');
    expect(mode).toBe('allow');
    const result = parseYaml(yamlText) as {
      routing: { 'model-time-gates': Array<Record<string, unknown>> };
    };
    expect(result.routing['model-time-gates'][0]).toEqual({
      name: 'whitelist',
      schedule: '0 1 * * 1-5',
      duration: '3h',
      enabled: true,
      mode: 'allow',
      models: ['deepseek-v3.2'],
    });
  });

  test('defaults a gate without mode to exclude and omits the default on write', () => {
    function Harness() {
      const visualConfig = useVisualConfig();
      const [phase, setPhase] = useState(0);

      if (phase === 0) {
        visualConfig.loadVisualValuesFromYaml(
          'routing:\n  model-time-gates:\n    - name: peek\n      schedule: "0 1 * * 1-5"\n      duration: 3h\n      provider: deepseek\n      models:\n        - deepseek-*\n'
        );
        setPhase(1);
        return null;
      }

      if (phase === 1) {
        return createElement(
          'pre',
          null,
          `${visualConfig.visualValues.modelTimeGates[0]?.mode ?? 'none'}\n---\n${visualConfig.applyVisualChangesToYaml(
            'routing:\n  model-time-gates:\n    - name: peek\n      schedule: "0 1 * * 1-5"\n      duration: 3h\n      provider: deepseek\n      models:\n        - deepseek-*\n'
          )}`
        );
      }

      return null;
    }

    const markup = renderToStaticMarkup(createElement(Harness));
    const [mode, yamlText] = unwrapPre(markup).split('\n---\n');
    expect(mode).toBe('exclude');
    const result = parseYaml(yamlText) as {
      routing: { 'model-time-gates': Array<Record<string, unknown>> };
    };
    const rule = result.routing['model-time-gates'][0];
    expect(rule.mode).toBeUndefined();
    expect(rule).toEqual({
      name: 'peek',
      schedule: '0 1 * * 1-5',
      duration: '3h',
      enabled: true,
      provider: 'deepseek',
      models: ['deepseek-*'],
    });
  });
});

describe('model time gate mode editor UI', () => {
  test('renders a mode selector offering exclude and allow', () => {
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ModelTimeGatesEditor, {
          value: [
            {
              id: 'gate-0',
              name: 'whitelist',
              schedule: '0 1 * * 1-5',
              duration: '3h',
              provider: '',
              authId: '',
              mode: 'allow',
              models: 'deepseek-v3.2',
              enabled: true,
            },
          ],
          onChange: () => {},
        })
      )
    );
    expect(markup).toContain('Allow only listed models');
    // The mode control is a listbox trigger (options render only when opened).
    expect(markup).toContain('aria-haspopup="listbox"');
  });
});
