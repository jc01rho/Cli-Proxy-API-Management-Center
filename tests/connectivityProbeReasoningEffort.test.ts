// 연결 테스트 프로브의 reasoning effort 고정 검증.
//
// 테스트 버튼 프로브가 reasoning_effort를 명시하지 않으면 백엔드 thinking
// 파이프라인이 모델이 지원하지 않는 기본값(예: 'minimal'/'auto')을 주입해
// 업스트림이 400 unsupported_value로 거절할 수 있다. 프로브 페이로드는 항상
// 최저 안전 레벨 'low'를 명시해야 한다.
//
// 소스 스캔 방식: 페이로드가 hook 내부의 JSON.stringify 리터럴에 있어
// 직접 호출보다 계약 고정이 견고하다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const connectivityTest = readFileSync(
  join(import.meta.dir, '..', 'src/features/providers/sheets/forms/useConnectivityTest.ts'),
  'utf8'
);

describe('connectivity probe pins lowest reasoning effort', () => {
  test('chat-completions probes pin reasoning_effort to low', () => {
    const pinned = connectivityTest.match(/reasoning_effort:\s*'low'/g) ?? [];
    expect(pinned.length).toBeGreaterThanOrEqual(1);
  });

  test('responses probes pin reasoning.effort to low', () => {
    const pinned = connectivityTest.match(/reasoning:\s*\{\s*effort:\s*'low'\s*\}/g) ?? [];
    expect(pinned.length).toBeGreaterThanOrEqual(2);
  });

  test('no openai-style probe leaves effort unpinned next to max_tokens', () => {
    // The Claude probe (max_tokens ?? 8, no stream) is native Claude format and
    // must not carry reasoning_effort; only openai-style probes are pinned.
    const probeBlocks = connectivityTest.match(
      /JSON\.stringify\(\{[\s\S]{0,400}?max_tokens[\s\S]{0,120}?\}\)/g
    ) ?? [];
    const openaiStyleBlocks = probeBlocks.filter((block) => !block.includes('?? 8'));
    expect(openaiStyleBlocks.length).toBeGreaterThan(0);
    for (const block of openaiStyleBlocks) {
      expect(block).toMatch(/reasoning_effort:\s*'low'/);
    }
  });
});
