import type { ProviderKeyConfig } from '@/types';
import { CodexSection } from '../CodexSection';
import type { ProviderRecentUsageMap } from '../utils';

interface CommandCodeSectionProps {
  configs: ProviderKeyConfig[];
  usageByProvider: ProviderRecentUsageMap;
  loading: boolean;
  disableControls: boolean;
  isSwitching: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onToggle: (index: number, enabled: boolean) => void;
}

export function CommandCodeSection(props: CommandCodeSectionProps) {
  return (
    <CodexSection
      {...props}
      providerKey="commandcode"
      titleKey="ai_providers.commandcode_title"
      addButtonKey="ai_providers.commandcode_add_button"
      emptyTitleKey="ai_providers.commandcode_empty_title"
      emptyDescKey="ai_providers.commandcode_empty_desc"
      itemTitleKey="ai_providers.commandcode_item_title"
      modelsCountKey="ai_providers.commandcode_models_count"
    />
  );
}
