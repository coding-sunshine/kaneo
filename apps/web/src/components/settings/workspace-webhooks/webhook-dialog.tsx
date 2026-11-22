import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createWorkspaceWebhook } from "@/fetchers/workspace-webhook/create-workspace-webhook";
import { updateWorkspaceWebhook } from "@/fetchers/workspace-webhook/update-workspace-webhook";
import {
  WEBHOOK_RESOURCE_TYPES,
  type WorkspaceWebhook,
  type WorkspaceWebhookValues,
} from "@/fetchers/workspace-webhook/webhook-types";
import useWorkspaceWebhookMutation from "@/hooks/mutations/workspace-webhook/use-workspace-webhook-mutation";

type Props = {
  workspaceId: string;
  webhook: WorkspaceWebhook | null;
  teams: { id: string; name: string }[];
  onClose: () => void;
  onSecret: (secret: string) => void;
};

function toggle(list: string[], value: string, on: boolean) {
  return on ? [...list, value] : list.filter((item) => item !== value);
}

export function WebhookDialog({
  workspaceId,
  webhook,
  teams,
  onClose,
  onSecret,
}: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<WorkspaceWebhookValues>(
    webhook ?? {
      label: "",
      url: "",
      enabled: true,
      resourceTypes: ["task"],
      projectIds: [],
    },
  );
  const create = useWorkspaceWebhookMutation(createWorkspaceWebhook);
  const update = useWorkspaceWebhookMutation(updateWorkspaceWebhook);
  const pending = create.isPending || update.isPending;
  const valid = Boolean(
    values.label.trim() && values.url && values.resourceTypes.length,
  );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) return;
    try {
      if (webhook) await update.mutateAsync({ ...values, id: webhook.id });
      else {
        const result = await create.mutateAsync({ ...values, workspaceId });
        onSecret(result.secret);
        create.reset();
      }
      onClose();
    } catch {
      return;
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {webhook
                ? t("settings:workspaceWebhooks.edit")
                : t("settings:workspaceWebhooks.add")}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <div className="space-y-5">
              <Field>
                <FieldLabel htmlFor="workspace-webhook-label">
                  {t("settings:workspaceWebhooks.label")}
                </FieldLabel>
                <Input
                  id="workspace-webhook-label"
                  required
                  maxLength={100}
                  value={values.label}
                  disabled={pending}
                  onChange={(e) =>
                    setValues({ ...values, label: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="workspace-webhook-url">
                  {t("settings:workspaceWebhooks.url")}
                </FieldLabel>
                <Input
                  id="workspace-webhook-url"
                  type="url"
                  required
                  maxLength={2048}
                  autoComplete="off"
                  placeholder="https://"
                  value={values.url}
                  disabled={pending}
                  onChange={(e) =>
                    setValues({ ...values, url: e.target.value })
                  }
                />
              </Field>
              <fieldset className="space-y-3" disabled={pending}>
                <legend className="mb-3 text-sm font-medium">
                  {t("settings:workspaceWebhooks.resources")}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {WEBHOOK_RESOURCE_TYPES.map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={values.resourceTypes.includes(type)}
                        onCheckedChange={(checked) =>
                          setValues({
                            ...values,
                            resourceTypes: toggle(
                              values.resourceTypes,
                              type,
                              checked,
                            ),
                          })
                        }
                      />
                      {t(`settings:workspaceWebhooks.types.${type}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-3" disabled={pending}>
                <legend className="text-sm font-medium">
                  {t("settings:workspaceWebhooks.teams")}
                </legend>
                <p className="text-xs text-muted-foreground">
                  {t("settings:workspaceWebhooks.teamsHint")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {teams.map((team) => (
                    <label
                      key={team.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={values.projectIds.includes(team.id)}
                        onCheckedChange={(checked) =>
                          setValues({
                            ...values,
                            projectIds: toggle(
                              values.projectIds,
                              team.id,
                              checked,
                            ),
                          })
                        }
                      />
                      {team.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center justify-between gap-4 text-sm font-medium">
                {t("settings:workspaceWebhooks.enabled")}
                <Switch
                  checked={values.enabled}
                  disabled={pending}
                  onCheckedChange={(enabled) =>
                    setValues({ ...values, enabled })
                  }
                />
              </label>
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={pending}
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending || !valid}>
              {webhook
                ? t("settings:workspaceWebhooks.save")
                : t("settings:workspaceWebhooks.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
