import { afterEach, describe, expect, test } from 'bun:test';
import { fetchKiroQuota } from '@/features/quota/providers/kiro/data';
import { apiCallApi } from '@/services/api/apiCall';
import type { AuthFileItem } from '@/types';
import {
  buildKiroQuotaData,
  buildKiroQuotaRows,
  isKiroFile,
  parseKiroUsagePayload,
} from '@/utils/quota';

const originalApiCallRequest = apiCallApi.request;

afterEach(() => {
  apiCallApi.request = originalApiCallRequest;
});

describe('Kiro quota request', () => {
  test('uses the profile ARN region and the management token placeholder', async () => {
    let request: Parameters<typeof apiCallApi.request>[0] | null = null;
    apiCallApi.request = (async (payload) => {
      request = payload;
      return {
        statusCode: 200,
        header: {},
        bodyText: '',
        body: {
          subscriptionInfo: {
            subscriptionTitle: 'Kiro Pro+',
            type: 'PRO',
          },
          usageBreakdownList: [
            {
              displayName: 'Agentic requests',
              resourceType: 'AGENTIC_REQUEST',
              currentUsage: 695,
              currentUsageWithPrecision: 695.17,
              usageLimit: 1000,
              usageLimitWithPrecision: 1000.5,
              unit: 'credits',
            },
          ],
          nextDateReset: 4_099_862_400_000,
        },
      };
    }) as typeof apiCallApi.request;

    const file = {
      name: 'kiro.json',
      provider: 'kiro',
      authIndex: 'kiro-auth-1',
      metadata: {
        profileArn: 'arn:aws:codewhisperer:eu-west-1:123456789012:profile/example',
      },
    } as AuthFileItem;

    const result = await fetchKiroQuota(file, ((key: string) => key) as never);

    expect(request).not.toBeNull();
    const url = new URL(request!.url);
    expect(url.origin).toBe('https://q.eu-west-1.amazonaws.com');
    expect(url.pathname).toBe('/getUsageLimits');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      isEmailRequired: 'true',
      origin: 'AI_EDITOR',
      profileArn: 'arn:aws:codewhisperer:eu-west-1:123456789012:profile/example',
      resourceType: 'AGENTIC_REQUEST',
    });
    expect(request!.authIndex).toBe('kiro-auth-1');
    expect(request!.header?.Authorization).toBe('Bearer $TOKEN$');
    expect(request!.header?.['x-amzn-kiro-agent-mode']).toBe('vibe');
    expect(request!.header?.['x-amz-target']).toBeUndefined();

    expect(result).toEqual({
      subscriptionTitle: 'Kiro Pro+',
      subscriptionType: 'PRO',
      rows: [
        {
          id: 'agentic-request',
          label: 'Agentic requests',
          used: 695.17,
          limit: 1000.5,
          unit: 'credits',
          resetAtMs: 4_099_862_400_000,
        },
      ],
    });
  });

  test('uses api_region and asks for identity when no profile ARN exists', async () => {
    let requestedUrl = '';
    apiCallApi.request = (async (payload) => {
      requestedUrl = payload.url;
      return {
        statusCode: 200,
        header: {},
        bodyText: '',
        body: {
          usageBreakdownList: [
            {
              resourceType: 'AGENTIC_REQUEST',
              currentUsage: 1,
              usageLimit: 50,
            },
          ],
        },
      };
    }) as typeof apiCallApi.request;

    await fetchKiroQuota(
      {
        name: 'kiro.json',
        provider: 'kiro',
        auth_index: 'kiro-auth-2',
        metadata: { api_region: 'ap-southeast-2' },
      } as AuthFileItem,
      ((key: string) => key) as never
    );

    const url = new URL(requestedUrl);
    expect(url.origin).toBe('https://q.ap-southeast-2.amazonaws.com');
    expect(url.searchParams.get('isEmailRequired')).toBe('true');
    expect(url.searchParams.has('profileArn')).toBeFalse();
  });
});

describe('Kiro quota parsing', () => {
  test('parses JSON strings and prefers precision fields', () => {
    const payload = parseKiroUsagePayload(
      JSON.stringify({
        usageBreakdownList: [
          {
            currentUsage: 4,
            currentUsageWithPrecision: 4.25,
            usageLimit: 10,
            usageLimitWithPrecision: 10.5,
            nextDateReset: 4_099_862_400_000,
          },
        ],
      })
    );

    expect(payload).not.toBeNull();
    expect(buildKiroQuotaRows(payload!)[0]).toMatchObject({
      used: 4.25,
      limit: 10.5,
      resetAtMs: 4_099_862_400_000,
    });
  });

  test('normalizes the actual kiro-lb payload shape', () => {
    const payload = parseKiroUsagePayload({
      subscriptionInfo: {
        subscriptionTitle: 'KIRO POWER',
        type: 'Q_DEVELOPER_STANDALONE_POWER',
      },
      usageBreakdownList: [
        {
          resourceType: 'CREDIT',
          currentUsageWithPrecision: 4663.3,
          usageLimitWithPrecision: 10000,
          unit: 'INVOCATIONS',
        },
      ],
      nextDateReset: 1_785_542_400,
    });

    expect(buildKiroQuotaData(payload!)).toEqual({
      subscriptionTitle: 'KIRO POWER',
      subscriptionType: 'Q_DEVELOPER_STANDALONE_POWER',
      rows: [
        {
          id: 'credit',
          label: 'CREDIT',
          used: 4663.3,
          limit: 10000,
          unit: 'INVOCATIONS',
          resetAtMs: 1_785_542_400_000,
        },
      ],
    });
  });

  test('recognizes only Kiro auth files', () => {
    expect(isKiroFile({ name: 'kiro.json', provider: 'kiro' } as AuthFileItem)).toBeTrue();
    expect(isKiroFile({ name: 'kimi.json', provider: 'kimi' } as AuthFileItem)).toBeFalse();
  });
});
