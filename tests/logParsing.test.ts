import { describe, expect, test } from 'bun:test';
import { parseLogLine } from '../src/pages/hooks/logParsing';

describe('structured log latency', () => {
  const prefix = '[2026-09-29 12:51:31] [00000a23] [warn ] [conductor_cooldown.go:740] ';

  for (const description of ['request waits 300s', 'bounded search 10s', '200 | 300s | POST /fake']) {
    test(`ignores duration-like tool description ${description}`, () => {
      const body = JSON.stringify({ type: 'response.failed', response: { tools: [{ description }] } });
      const raw = `${prefix}request failed error=${body}`;
      const parsed = parseLogLine(raw);
      expect(parsed.latency).toBeUndefined();
      expect(parsed.raw).toBe(raw);
      expect(parsed.message).toBe(`request failed error=${body}`);
    });
  }

  for (const duration of ['48.237s', '1.593s', '800µs', '800us', '250ms', '1m2.5s', '0s']) {
    test(`reads access log column ${duration}`, () => {
      const parsed = parseLogLine(`${prefix}200 | ${duration} | 127.0.0.1 | POST "/v1/chat/completions" | test-model`);
      expect(parsed.latency).toBe(duration);
      expect(parsed.statusCode).toBe(200);
      expect(parsed.method).toBe('POST');
    });
  }

  test('reads old Gin prefix before the status column', () => {
    expect(parseLogLine('[GIN] 2026/09/29 - 12:51:31 | 200 | 48.237s | 127.0.0.1 | POST "/v1/responses"').latency).toBe('48.237s');
  });

  test('reads execution failure latency without taking error-body durations', () => {
    expect(parseLogLine(`${prefix}502 | 1.593s | upstream execution failed: provider=p err={"message":"timeout 300s"}`).latency).toBe('1.593s');
  });

  test('reads the explicit duration field on the no-status execution log', () => {
    expect(parseLogLine(`${prefix}upstream execution failed: provider=p model=m auth=api_key=masked duration=2.75s err=timeout 300s`).latency).toBe('2.75s');
  });

  test('ignores a duration in an unrelated pipe-delimited message', () => {
    expect(parseLogLine(`${prefix}request failed | tools | 300s | retry`).latency).toBeUndefined();
  });

  test('ignores duration= inside an error body', () => {
    expect(parseLogLine(`${prefix}upstream execution failed: provider=p err={"message":"duration=300s"}`).latency).toBeUndefined();
  });
});
