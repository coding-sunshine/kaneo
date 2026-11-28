import { useTranslation } from "react-i18next";
import { CustomFieldRow } from "@/components/custom-fields/custom-field-row";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";

/**
 * The team's required fields a ticket from a thread needs before it can be
 * made, since they have no default. The values go with Accept.
 */
export function ProposalTicketFields({
  projectId,
  fieldIds,
  values,
  onChange,
  disabled,
}: {
  projectId: string;
  fieldIds: string[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { data } = useGetCustomFieldsByProject(projectId) as {
    data: CustomFieldDefinition[] | undefined;
  };
  const fields = (data ?? []).filter((field) => fieldIds.includes(field.id));
  if (fields.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-muted-foreground text-xs">
        {t("navigation:agent.proposal.requiredFields")}
      </legend>
      {fields.map((field) => (
        <CustomFieldRow
          key={field.id}
          field={field}
          value={values[field.id] ?? ""}
          onChange={(value) => onChange(field.id, value)}
          disabled={disabled}
        />
      ))}
    </fieldset>
  );
}
