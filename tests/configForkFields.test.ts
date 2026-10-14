import { describe, expect, test } from 'bun:test';
import { Children, createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { DEFAULT_VISUAL_VALUES, type VisualConfigValues } from '@/types/visualConfig';
import { ApiKeysField, ForkOnlyFields } from '@/features/config/components/fields/sharedFields';
import { ApiKeysCardEditor } from '@/features/config/components/blocks/ApiKeysCardEditor';
import { findConfigFieldById } from '@/features/config/searchIndex';

const translations = i18n.cloneInstance({ lng: 'en' });
const render = (element: ReactElement) =>
  renderToStaticMarkup(createElement(I18nextProvider, { i18n: translations }, element));

describe('fork settings in the setting-row layout', () => {
  test('preserves all eight advanced search anchors and populated fallback values', () => {
    const markup = render(
      createElement(ForkOnlyFields, {
        values: {
          ...DEFAULT_VISUAL_VALUES,
          fallbackModels: { 'gpt-4o': 'gpt-4o-mini' },
          fallbackChain: ['gpt-4o-mini'],
          fallbackMaxDepth: '5',
        },
        disabled: false,
        onChange: () => {},
      })
    );
    for (const fieldId of [
      'routingMode',
      'tokenThresholdRules',
      'modelTimeGates',
      'fallbackModels',
      'fallbackChain',
      'fallbackMaxDepth',
      'oauthEndpointOverrides',
      'apiKeyIpBlacklist',
    ]) {
      expect(markup.split(`id="cfg-field-${fieldId}"`)).toHaveLength(2);
      expect(findConfigFieldById(fieldId)?.sectionId).toBe('advanced');
    }
    expect(markup).toContain('value="gpt-4o"');
    expect(markup).toContain('value="gpt-4o-mini"');
    expect(markup).toContain('value="5"');
  });

  test('uses the serialized routing mode values and forwards selection changes', () => {
    const changes: Partial<VisualConfigValues>[] = [];
    type Row = ReactElement<{
      fieldId: string;
      value: string;
      options: Array<{ value: string }>;
      onChange: (value: string) => void;
    }>;
    let rows: Row[] = [];
    function Harness() {
      const fields = ForkOnlyFields({
        values: DEFAULT_VISUAL_VALUES,
        disabled: false,
        onChange: (patch) => changes.push(patch),
      });
      rows = Children.toArray(fields.props.children) as Row[];
      return fields;
    }
    render(createElement(Harness));
    const routing = rows.find((row) => row.props.fieldId === 'routingMode')!;
    expect(routing.props.value).toBe('provider-based');
    expect(routing.props.options.map((option) => option.value)).toEqual([
      'provider-based',
      'key-based',
    ]);
    routing.props.onChange('key-based');
    expect(changes).toEqual([{ routingMode: 'key-based' }]);
  });

  test('wires model restrictions into the upstream API key editor', () => {
    const changes: Partial<VisualConfigValues>[] = [];
    const field = ApiKeysField({
      values: {
        ...DEFAULT_VISUAL_VALUES,
        apiKeysText: 'sk-fixture',
        apiKeyModelWhitelists: { 'sk-fixture': ['gpt-*'] },
      },
      disabled: true,
      onChange: (patch) => changes.push(patch),
    });
    const editor = field.props.children.props.children;
    expect(editor.type).toBe(ApiKeysCardEditor);
    expect(editor.props.modelWhitelists).toEqual({ 'sk-fixture': ['gpt-*'] });
    expect(editor.props.disabled).toBe(true);
    const markup = render(field);
    expect(markup).toContain('gpt-*');
    for (const control of markup.match(/<button\b[^>]*>/g) ?? []) {
      expect(control).toContain('disabled=""');
    }
    editor.props.onModelWhitelistsChange({ 'sk-fixture': ['claude-*'] });
    expect(changes).toEqual([{ apiKeyModelWhitelists: { 'sk-fixture': ['claude-*'] } }]);
  });
});
