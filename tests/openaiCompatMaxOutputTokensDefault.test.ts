// openaiCompatibility 的 maxOutputTokens 默认值守卫。
//
// 该字段是 /#/ai-providers 里 OpenAI 兼容 provider 的连通性测试 max_tokens。
// 默认值 5 太小，会让带 reasoning 的模型在首字之前就被截断，测试假失败；
// 现固定为 20。三处必须同步，漏改任何一处都会让默认值退回旧值：
//   ① buildInitialForm 新建分支（brand === 'openaiCompatibility'）
//   ② buildInitialForm 载入既有配置分支（OpenAIProviderConfig）
//   ③ useConnectivityTest 的 max_tokens 兜底（表单未提供时）
//
// 用源码扫描而非直接调用：buildInitialForm 未导出，且兜底值嵌在请求体构造里。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const readSource = (relativePath: string) =>
  readFileSync(join(import.meta.dir, '..', relativePath), 'utf8');

const baseProviderForm = readSource('src/features/providers/sheets/forms/BaseProviderForm.tsx');
const connectivityTest = readSource('src/features/providers/sheets/forms/useConnectivityTest.ts');

const OPENAI_COMPAT_DEFAULT = 20;

describe('openaiCompatibility maxOutputTokens default', () => {
  test('new-provider branch defaults to 20', () => {
    const branch = baseProviderForm.match(
      /maxOutputTokens:\s*\n?\s*brand === 'openaiCompatibility'\s*\n?\s*\?\s*(\d+)/
    );
    expect(branch).not.toBeNull();
    expect(Number(branch![1])).toBe(OPENAI_COMPAT_DEFAULT);
  });

  test('existing-config branch defaults to 20', () => {
    const assignments = Array.from(
      baseProviderForm.matchAll(/maxOutputTokens:\s*(\d+),/g),
      (match) => Number(match[1])
    );
    expect(assignments).toContain(OPENAI_COMPAT_DEFAULT);
    expect(assignments).not.toContain(5);
  });

  test('connectivity-test max_tokens fallback is 20', () => {
    const fallback = connectivityTest.match(/max_tokens:\s*maxOutputTokens\s*\?\?\s*(\d+)/);
    expect(fallback).not.toBeNull();
    expect(Number(fallback![1])).toBe(OPENAI_COMPAT_DEFAULT);
  });

  test('claude-like and gemini branches keep their own default of 8', () => {
    expect(baseProviderForm).toContain("isClaudeLikeBrand(brand) || brand === 'gemini' ? 8 : undefined");
  });
});
