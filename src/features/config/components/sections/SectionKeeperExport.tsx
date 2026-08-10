import { KeeperExportSection } from '@/components/config/KeeperExportSection';
import { CONFIG_TAB_ICONS, SECTION_INDEX_LABELS } from '../../constants';
import type { ConfigSectionProps } from '../../types';
import { SectionCard } from '../SectionCard';
import { FieldAnchor } from '../fields/FieldPrimitives';

const Icon = CONFIG_TAB_ICONS.keeperExport;

export function SectionKeeperExport({
  values,
  disabled,
  animateIn,
  onChange,
}: ConfigSectionProps) {
  return (
    <SectionCard
      indexLabel={SECTION_INDEX_LABELS.keeperExport}
      icon={<Icon size={16} />}
      title="Keeper Export"
      description="Push usage and metadata to a CPA Usage Keeper instance."
      animateIn={animateIn}
    >
      <FieldAnchor fieldId="keeperExportEnabled">
        <FieldAnchor fieldId="keeperUrl">
          <FieldAnchor fieldId="keeperDelivery">
            <FieldAnchor fieldId="keeperMetadata">
              <FieldAnchor fieldId="keeperPrivacy">
                <FieldAnchor fieldId="keeperTokenEnv">
                  <FieldAnchor fieldId="keeperOutbox">
                    <FieldAnchor fieldId="keeperBacklog">
                      <KeeperExportSection
                        values={values.keeperExport}
                        validationErrors={[]}
                        usageStatisticsEnabled={values.usageStatisticsEnabled}
                        disabled={disabled}
                        onChange={(keeperExport) => onChange({ keeperExport })}
                      />
                    </FieldAnchor>
                  </FieldAnchor>
                </FieldAnchor>
              </FieldAnchor>
            </FieldAnchor>
          </FieldAnchor>
        </FieldAnchor>
      </FieldAnchor>
    </SectionCard>
  );
}
