import { describe, expect, test } from 'bun:test';
import { createElement, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useVisualConfig } from '../src/hooks/useVisualConfig';
import type { VisualConfigValues } from '../src/types/visualConfig';

/**
 * Loads `yaml`, then applies each patch in its own render pass, returning the
 * sorted dirty-field set observed after every patch.
 */
function collectDirtyFields(yaml: string, patches: Array<Partial<VisualConfigValues>>): string[][] {
  const snapshots: string[][] = [];

  function Harness() {
    const visualConfig = useVisualConfig();
    const [phase, setPhase] = useState(0);

    if (phase === 0) {
      visualConfig.loadVisualValuesFromYaml(yaml);
      setPhase(1);
      return null;
    }

    const patch = patches[phase - 1];
    if (patch) {
      visualConfig.setVisualValues(patch);
      setPhase(phase + 1);
      return null;
    }

    snapshots.push([...visualConfig.visualDirtyFields].sort());
    return null;
  }

  renderToStaticMarkup(createElement(Harness));
  return snapshots;
}

/** Dirty set after the final patch of the sequence. */
function finalDirtyFields(yaml: string, patches: Array<Partial<VisualConfigValues>>): string[] {
  const snapshots = collectDirtyFields(yaml, patches);
  return snapshots[snapshots.length - 1] ?? [];
}

describe('visual config dirty tracking', () => {
  test('marks the fallback chain dirty and clean again', () => {
    const yaml = 'routing:\n  fallback-chain:\n    - gpt-4o\n';

    expect(finalDirtyFields(yaml, [{ fallbackChain: ['gpt-4o', 'gpt-4o-mini'] }])).toEqual([
      'fallbackChain',
    ]);

    expect(
      finalDirtyFields(yaml, [
        { fallbackChain: ['gpt-4o', 'gpt-4o-mini'] },
        { fallbackChain: ['gpt-4o'] },
      ])
    ).toEqual([]);
  });

  test('tracks the remaining routing and fallback fields', () => {
    expect(
      finalDirtyFields('routing:\n  strategy: round-robin\n', [
        {
          fallbackModels: { 'gpt-4o': 'gpt-4o-mini' },
          fallbackMaxDepth: '5',
          routingMode: 'key-based',
          enableGeminiCliEndpoint: true,
        },
      ])
    ).toEqual(['enableGeminiCliEndpoint', 'fallbackMaxDepth', 'fallbackModels', 'routingMode']);
  });

  test('clears api key model whitelist dirt when the value returns to the baseline', () => {
    const yaml = 'api-keys:\n  - sk-test\napi-key-model-whitelists:\n  sk-test:\n    - gpt-4o\n';

    expect(
      finalDirtyFields(yaml, [{ apiKeyModelWhitelists: { 'sk-test': ['gpt-4o', 'gpt-4o-mini'] } }])
    ).toEqual(['apiKeyModelWhitelists']);

    expect(
      finalDirtyFields(yaml, [
        { apiKeyModelWhitelists: { 'sk-test': ['gpt-4o', 'gpt-4o-mini'] } },
        { apiKeyModelWhitelists: { 'sk-test': ['gpt-4o'] } },
      ])
    ).toEqual([]);
  });
});
