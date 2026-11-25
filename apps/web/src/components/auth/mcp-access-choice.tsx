import { useTranslation } from "react-i18next";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Label } from "@/components/ui/label";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import type { McpAccess } from "./mcp-access";

type Props = {
  value: McpAccess;
  onChange: (value: McpAccess) => void;
  disabled?: boolean;
};

export function McpAccessChoice({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();

  return (
    <Fieldset
      className="max-w-none gap-3 rounded-xl border border-border px-3.5 py-3 dark:bg-input/16"
      render={
        <RadioGroup
          disabled={disabled}
          value={value}
          onValueChange={(next) =>
            onChange(next === "documents" ? "documents" : "full")
          }
        />
      }
    >
      <FieldsetLegend className="font-normal text-muted-foreground text-xs">
        {t("auth:mcp.authorize.access")}
      </FieldsetLegend>
      <Label className="items-start gap-3">
        <Radio value="full" />
        <span className="flex flex-col gap-0.5">
          {t("auth:mcp.authorize.accessFull")}
          <span className="font-normal text-muted-foreground text-xs">
            {t("auth:mcp.authorize.accessFullDescription")}
          </span>
        </span>
      </Label>
      <Label className="items-start gap-3">
        <Radio value="documents" />
        <span className="flex flex-col gap-0.5">
          {t("auth:mcp.authorize.accessDocuments")}
          <span className="font-normal text-muted-foreground text-xs">
            {t("auth:mcp.authorize.accessDocumentsDescription")}
          </span>
        </span>
      </Label>
    </Fieldset>
  );
}
