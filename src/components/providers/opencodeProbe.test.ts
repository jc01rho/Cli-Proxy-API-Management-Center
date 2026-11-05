import { describe, expect, test } from 'bun:test';
import {
  OPENCODE_PROBE_USER_AGENT,
  buildOpenCodeProbeHeaders,
  buildOpenCodeSessionId,
  isOpenCodeHost,
} from './utils';

describe('OpenCode probe fingerprint', () => {
  test('session id uses the CLI ses_ shape the gateway accepts', () => {
    const id = buildOpenCodeSessionId(1793897887082);
    expect(id).toMatch(/^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/);
    // ids sort descending: computed from a bitwise-inverted timestamp
    const later = buildOpenCodeSessionId(1793897887083);
    expect(later.slice(4, 16) < id.slice(4, 16)).toBe(true);
  });

  test('probe headers carry the client identity the gateway requires', () => {
    const id = buildOpenCodeSessionId(1793897887082);
    const headers = buildOpenCodeProbeHeaders(id);
    expect(headers['User-Agent']).toBe(OPENCODE_PROBE_USER_AGENT);
    expect(headers['x-opencode-client']).toBe('cli');
    expect(headers['x-opencode-session']).toBe(id);
    expect(headers['x-opencode-request']).toMatch(/^req_/);
  });

  test('detects every OpenCode gateway base url', () => {
    expect(isOpenCodeHost('https://opencode.ai/inference/go/openai/v1')).toBe(true);
    expect(isOpenCodeHost('https://opencode.ai/zen/go/v1')).toBe(true);
    expect(isOpenCodeHost('https://api.other.example/v1')).toBe(false);
    expect(isOpenCodeHost('https://opencode.ai.evil.test/v1')).toBe(false);
    expect(isOpenCodeHost('')).toBe(false);
  });
});
