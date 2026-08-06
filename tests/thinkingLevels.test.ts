import { describe, expect, test } from 'bun:test';
import {
  buildThinkingFromLevels,
  readThinkingLevels,
  THINKING_LEVELS,
} from '../src/features/providers/thinkingLevels';

describe('standard thinking level selector', () => {
  test('only exposes levels recognized by the backend', () => {
    expect(THINKING_LEVELS).toEqual([
      'none',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
      'auto',
      'enable',
      'disable',
      'adaptive',
    ]);
  });

  test('reads standard levels and legacy capability flags', () => {
    expect(
      readThinkingLevels({
        levels: ['LOW', 'custom', 'high', 'none', 'ENABLE', 'disable', 'Adaptive'],
        zero_allowed: true,
        dynamic_allowed: true,
      })
    ).toEqual(['none', 'low', 'high', 'auto', 'enable', 'disable', 'adaptive']);
  });

  test('writes canonical backend levels and omits an empty selection', () => {
    expect(buildThinkingFromLevels([])).toBeUndefined();
    expect(buildThinkingFromLevels(['adaptive', 'auto', 'high', 'none', 'low', 'enable'])).toEqual({
      levels: ['low', 'high', 'none', 'auto', 'enable', 'adaptive'],
    });
  });
});
