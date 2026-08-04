import { describe, expect, test } from 'bun:test';
import { parseApiErrorResponse } from '../src/services/api/apiError';
import { getVisualConfigValidationErrors } from '../src/hooks/useVisualConfig';
import { DEFAULT_VISUAL_VALUES } from '../src/types/visualConfig';

/**
 * Baseline characterization for the seams the keeper-export/v1 contract work
 * builds on. These tests pin existing behavior before any usage-export code
 * exists; they must stay green while strict decoders are added.
 */
describe('keeper-export baseline characterization', () => {
  test('API client error seam preserves the stable keeper-export error code', () => {
    // keeper-export/v1 stable error envelope (spec section 9) flowing through
    // the existing normalization seam must keep error.code as apiCode so the
    // UI can branch on stable codes instead of message text.
    const envelope = {
      protocolVersion: 'keeper-export/v1',
      error: {
        code: 'conflicting_replay',
        message: 'sequence was previously accepted with different payload',
        retryable: false,
      },
    };

    const parsed = parseApiErrorResponse(envelope, 'Request failed with status code 409');

    expect(parsed.apiCode).toBe('conflicting_replay');
    expect(parsed.message).toBe('sequence was previously accepted with different payload');
  });

  test('API client error seam never surfaces token material from an error body', () => {
    const parsed = parseApiErrorResponse(
      {
        error: { code: 'invalid_credential', message: 'ingest credential is invalid' },
        token: 'must-not-leak',
      },
      'Request failed with status code 401'
    );

    expect(parsed.apiCode).toBe('invalid_credential');
    expect(parsed.message).not.toContain('must-not-leak');
  });

  test('visual config validation baseline accepts untouched default values', () => {
    // Characterizes the current config-validation seam: a pristine visual
    // state (no user edits, nothing materialized into YAML) has no validation
    // errors. Usage-export settings must slot in without disturbing this.
    expect(getVisualConfigValidationErrors(DEFAULT_VISUAL_VALUES)).toEqual({});
  });
});
