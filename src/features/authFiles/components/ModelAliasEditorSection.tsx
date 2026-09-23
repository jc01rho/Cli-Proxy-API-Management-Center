import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconX } from '@/components/ui/icons';
import type { OAuthModelAliasEntry } from '@/types';
import { buildEmptyRow, toRows, type ModelAliasRow } from './modelAliasRows';
import styles from './ModelAliasEditorSection.module.scss';

const toEntries = (rows: ModelAliasRow[]): OAuthModelAliasEntry[] =>
  rows.map(({ id: _id, ...entry }) => entry);

export type ModelAliasEditorSectionProps = {
  value: OAuthModelAliasEntry[];
  disabled: boolean;
  error: string | null;
  onChange: (rows: OAuthModelAliasEntry[]) => void;
};

/**
 * Per-auth model alias row editor for the credential details sheet. Rows are
 * edited locally and pushed up as a plain OAuthModelAliasEntry[] so the parent
 * hook can diff against the original and build the PATCH payload.
 */
export function ModelAliasEditorSection({
  value,
  disabled,
  error,
  onChange,
}: ModelAliasEditorSectionProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ModelAliasRow[]>(() => toRows(value));

  useEffect(() => {
    setRows((previousRows) => toRows(value, previousRows));
  }, [value]);

  const commitRows = (next: ModelAliasRow[]) => {
    setRows(next);
    onChange(toEntries(next));
  };

  const updateRow = (index: number, patch: Partial<ModelAliasRow>) => {
    commitRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    commitRows([...rows, buildEmptyRow()]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      commitRows(rows.filter((_, rowIndex) => rowIndex !== index));
    }
  };

  return (
    <div className="form-group">
      <div className={styles.sectionLabel}>{t('auth_file_details.model_aliases.label')}</div>
      <div className={styles.rows}>
        {rows.map((row, index) => (
          <div key={row.id} className={styles.row}>
            <Input
              value={row.name}
              placeholder={t('auth_file_details.model_aliases.name_placeholder')}
              disabled={disabled}
              onChange={(e) => updateRow(index, { name: e.target.value })}
            />
            <span className={styles.separator}>→</span>
            <Input
              value={row.alias}
              placeholder={t('auth_file_details.model_aliases.alias_placeholder')}
              disabled={disabled}
              onChange={(e) => updateRow(index, { alias: e.target.value })}
            />
            <div className={styles.fork}>
              <ToggleSwitch
                label={t('auth_file_details.model_aliases.fork_label')}
                labelPosition="left"
                checked={Boolean(row.fork)}
                onChange={(fork) => updateRow(index, { fork })}
                disabled={disabled}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRow(index)}
              disabled={disabled || rows.length <= 1}
              title={t('common.delete')}
              aria-label={t('common.delete')}
            >
              <IconX size={14} />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="secondary" size="sm" onClick={addRow} disabled={disabled}>
        {t('auth_file_details.model_aliases.add')}
      </Button>
      <div className="hint">{t('auth_file_details.model_aliases.hint')}</div>
      {error && <div className="error-box">{error}</div>}
    </div>
  );
}
