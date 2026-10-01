import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconChevronDown, IconPlus, IconX } from '@/components/ui/icons';
import { Select } from '@/components/ui/Select';
import { ModelAdvancedFields } from './ModelAdvancedFields';
import type { ModelEntryInput, ProviderBrand } from '../../types';
import styles from './sharedForm.module.scss';

const COLLAPSED_LIMIT = 10;

interface ModelEntriesEditorProps {
  models: ModelEntryInput[];
  /** Restrict advanced controls to the OAuthModelAlias contract. */
  oauthAliasOnly?: boolean;
  providerBrand?: ProviderBrand;
  /** Only OpenAI-compatible entries can expose the image-generation capability. */
  supportsImage: boolean;
  supportsEndpoints?: boolean;
  /** Every backend provider model can override its thinking capability. */
  supportsThinking: boolean;
  mutating: boolean;
  removeDisabled: boolean;
  onUpdate: (idx: number, patch: Partial<ModelEntryInput>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}

export function ModelEntriesEditor({
  models,
  oauthAliasOnly = false,
  providerBrand = 'gemini',
  supportsImage,
  supportsEndpoints = false,
  supportsThinking,
  mutating,
  removeDisabled,
  onUpdate,
  onAdd,
  onRemove,
}: ModelEntriesEditorProps) {
  const { t } = useTranslation();
  const fid = useId();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const handleAdd = () => {
    // New rows are appended; make sure the truncated list doesn't hide them.
    if (!showAll && models.length >= COLLAPSED_LIMIT) {
      setShowAll(true);
    }
    onAdd();
  };

  const handleRemove = (removeIdx: number) => {
    setExpandedIdx((prev) => {
      if (prev === null || prev === removeIdx) return null;
      return prev > removeIdx ? prev - 1 : prev;
    });
    onRemove(removeIdx);
  };

  const visible = showAll ? models : models.slice(0, COLLAPSED_LIMIT);

  return (
    <>
      {visible.map((entry, idx) => {
        const expanded = expandedIdx === idx;
        const hasThinking = entry.thinkingEnabled ?? Boolean(entry.thinkingJson?.trim());
        const endpoints = entry.supportedEndpoints ?? [];
        const automatic = endpoints.length === 0 ||
          (endpoints.length === 2 && endpoints.includes('/responses') &&
            endpoints.includes('/chat/completions'));
        const endpointValue = automatic ? '' : JSON.stringify(endpoints);
        const endpointOptions = [
          { value: '', label: t('providersPage.form.modelEndpointsAutomatic') },
          { value: '["/responses"]', label: t('providersPage.form.modelEndpointsResponses') },
          { value: '["/chat/completions"]', label: t('providersPage.form.modelEndpointsChat') },
        ];
        if (!endpointOptions.some((option) => option.value === endpointValue)) {
          endpointOptions.push({ value: endpointValue, label: endpoints.join(', ') });
        }
        return (
          <div key={idx} className={styles.modelEntry}>
            <div className={styles.modelAliasRow}>
              <input
                className={styles.input}
                placeholder={t('providersPage.modelOptions.modelName')}
                aria-label={t('providersPage.modelOptions.modelName')}
                value={entry.name}
                onChange={(e) => onUpdate(idx, { name: e.target.value })}
                disabled={mutating}
              />
              <input
                className={styles.input}
                placeholder={t(
                  oauthAliasOnly
                    ? 'auth_files.policy_alias_name'
                    : 'providersPage.modelOptions.modelAlias'
                )}
                aria-label={t(
                  oauthAliasOnly
                    ? 'auth_files.policy_alias_name'
                    : 'providersPage.modelOptions.modelAlias'
                )}
                required={oauthAliasOnly}
                value={entry.alias ?? ''}
                onChange={(e) => onUpdate(idx, { alias: e.target.value })}
                disabled={mutating}
              />
              <div className={styles.modelEntryActions}>
                {!oauthAliasOnly && supportsImage && !expanded && entry.image === true ? (
                  <span className={styles.entryBadge}>
                    {t('providersPage.form.modelBadgeImage')}
                  </span>
                ) : null}
                {!oauthAliasOnly && supportsThinking && !expanded && hasThinking ? (
                  <span className={styles.entryBadge}>
                    {t('providersPage.form.modelBadgeThinking')}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={styles.entryCardIconBtn}
                  onClick={() => setExpandedIdx(expanded ? null : idx)}
                  title={expanded ? t('common.collapse') : t('common.expand')}
                  aria-label={expanded ? t('common.collapse') : t('common.expand')}
                  aria-expanded={expanded}
                  disabled={mutating}
                >
                  <IconChevronDown
                    className={[
                      styles.entryCardChevron,
                      expanded ? styles.entryCardChevronOpen : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    size={14}
                  />
                </button>
                <button
                  type="button"
                  className={styles.removeBtn}
                  aria-label={t('providersPage.modelOptions.removeModel')}
                  disabled={mutating || removeDisabled}
                  onClick={() => handleRemove(idx)}
                >
                  <IconX size={12} />
                </button>
              </div>
            </div>
            {supportsEndpoints ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`${fid}-model-endpoints-${idx}`}>
                  {t('providersPage.form.modelEndpoints')}
                </label>
                <Select
                  id={`${fid}-model-endpoints-${idx}`}
                  value={endpointValue}
                  options={endpointOptions}
                  onChange={(value) => onUpdate(idx, {
                    supportedEndpoints: value === '' ? undefined : JSON.parse(value) as string[],
                  })}
                  disabled={mutating}
                  ariaLabel={t('providersPage.form.modelEndpointsLabel', {
                    model: entry.name || String(idx + 1),
                  })}
                  ariaDescribedBy={`${fid}-model-endpoints-hint-${idx}`}
                />
                <small id={`${fid}-model-endpoints-hint-${idx}`} className={styles.labelHint}>
                  {t('providersPage.form.modelEndpointsHint')}
                </small>
              </div>
            ) : null}
            {expanded ? (
              <div className={styles.modelEntryDetails}>
                {!oauthAliasOnly && supportsImage ? (
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      className={styles.checkboxBox}
                      checked={entry.image === true}
                      disabled={mutating}
                      onChange={(e) => onUpdate(idx, { image: e.target.checked })}
                    />
                    <span className={styles.checkboxText}>
                      <span>{t('providersPage.form.modelImage')}</span>
                      <small>{t('providersPage.form.modelImageHint')}</small>
                    </span>
                  </label>
                ) : null}
                {oauthAliasOnly ? (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>
                        {t('auth_files.policy_alias_display_name')}
                        <input
                          className={styles.input}
                          value={entry.displayName ?? ''}
                          disabled={mutating}
                          onChange={(event) => onUpdate(idx, { displayName: event.target.value })}
                        />
                      </label>
                    </div>
                    {(['fork', 'forceMapping'] as const).map((field) => (
                      <label key={field} className={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          className={styles.checkboxBox}
                          checked={entry[field] === true}
                          disabled={mutating}
                          onChange={(event) => onUpdate(idx, { [field]: event.target.checked })}
                        />
                        <span className={styles.checkboxText}>
                          {t(
                            field === 'fork'
                              ? 'auth_files.policy_alias_fork'
                              : 'auth_files.policy_alias_force_mapping'
                          )}
                        </span>
                      </label>
                    ))}
                  </>
                ) : (
                  <ModelAdvancedFields
                    entry={entry}
                    providerBrand={providerBrand}
                    disabled={mutating}
                    supportsThinking={supportsThinking}
                    onUpdate={(patch) => onUpdate(idx, patch)}
                  />
                )}
              </div>
            ) : null}
          </div>
        );
      })}
      {models.length > COLLAPSED_LIMIT ? (
        <button type="button" className={styles.showMoreBtn} onClick={() => setShowAll((v) => !v)}>
          {showAll
            ? t('providersPage.form.showFewerEntries')
            : t('providersPage.form.showAllEntries', { count: models.length })}
        </button>
      ) : null}
      <button type="button" className={styles.addBtn} disabled={mutating} onClick={handleAdd}>
        <IconPlus size={12} />
        <span>{t('providersPage.form.addModel')}</span>
      </button>
    </>
  );
}
