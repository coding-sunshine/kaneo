import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { WebhookSecretDialog } from "@/components/admin/webhooks/webhook-secret-dialog";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { deleteWorkspaceWebhook } from "@/fetchers/workspace-webhook/delete-workspace-webhook";
import { updateWorkspaceWebhook } from "@/fetchers/workspace-webhook/update-workspace-webhook";
import type { WorkspaceWebhook } from "@/fetchers/workspace-webhook/webhook-types";
import useWorkspaceWebhookMutation from "@/hooks/mutations/workspace-webhook/use-workspace-webhook-mutation";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useWorkspaceWebhooks from "@/hooks/queries/workspace-webhook/use-workspace-webhooks";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { WebhookDialog } from "./webhook-dialog";

export default function WorkspaceWebhooksPanel() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { data, isLoading, isError, refetch } =
    useWorkspaceWebhooks(workspaceId);
  const { data: projects } = useGetProjects({ workspaceId });
  const teams = (projects ?? []).map(({ id, name }) => ({ id, name }));
  const teamName = (id: string) =>
    teams.find((team) => team.id === id)?.name ?? id;
  const [editing, setEditing] = useState<WorkspaceWebhook | null | undefined>(
    undefined,
  );
  const [secret, setSecret] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceWebhook | null>(null);
  const remove = useWorkspaceWebhookMutation(deleteWorkspaceWebhook);
  const toggle = useWorkspaceWebhookMutation(updateWorkspaceWebhook);
  const pending = remove.isPending || toggle.isPending;
  return (
    <SettingsPage
      title={t("settings:workspaceWebhooks.title")}
      actions={
        <Button type="button" size="sm" onClick={() => setEditing(null)}>
          <PlusIcon aria-hidden="true" />
          {t("settings:workspaceWebhooks.add")}
        </Button>
      }
    >
      <SettingsCard>
        {isLoading ? <SettingsRowsSkeleton rows={3} /> : null}
        {isError ? (
          <DirectoryErrorRow
            message={t("settings:workspaceWebhooks.loadError")}
            retryLabel={t("settings:adminUsers.retry")}
            onRetry={() => refetch()}
          />
        ) : null}
        {data?.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("settings:workspaceWebhooks.empty")}
          </p>
        ) : null}
        {data?.length ? (
          <div
            role="list"
            aria-label={t("settings:workspaceWebhooks.title")}
            className="divide-y divide-border"
          >
            {data.map((webhook) => (
              <div
                key={webhook.id}
                role="listitem"
                className="flex items-center gap-4 px-4 py-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {webhook.label}
                    </span>
                    <Badge variant={webhook.enabled ? "success" : "secondary"}>
                      {webhook.enabled
                        ? t("settings:workspaceWebhooks.enabled")
                        : t("settings:workspaceWebhooks.disabled")}
                    </Badge>
                  </div>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={webhook.url}
                  >
                    {webhook.url}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {webhook.resourceTypes.map((type) => (
                      <Badge key={type} variant="outline">
                        {t(`settings:workspaceWebhooks.types.${type}`)}
                      </Badge>
                    ))}
                    {webhook.projectIds.length === 0 ? (
                      <Badge variant="secondary">
                        {t("settings:workspaceWebhooks.allTeams")}
                      </Badge>
                    ) : (
                      webhook.projectIds.map((id) => (
                        <Badge key={id} variant="secondary">
                          {teamName(id)}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <Switch
                  aria-label={t("settings:workspaceWebhooks.toggle", {
                    label: webhook.label,
                  })}
                  checked={webhook.enabled}
                  disabled={pending}
                  onCheckedChange={(enabled) =>
                    toggle.mutate({ id: webhook.id, enabled })
                  }
                />
                <RowActionsMenu
                  label={t("settings:workspaceWebhooks.actions", {
                    label: webhook.label,
                  })}
                  actions={[
                    {
                      id: "edit",
                      label: t("settings:workspaceWebhooks.edit"),
                      icon: PencilIcon,
                      onSelect: () => setEditing(webhook),
                      disabled: pending,
                    },
                    {
                      id: "delete",
                      label: t("common:actions.delete"),
                      icon: Trash2Icon,
                      onSelect: () => setDeleting(webhook),
                      destructive: true,
                      disabled: pending,
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        ) : null}
      </SettingsCard>
      {editing !== undefined ? (
        <WebhookDialog
          workspaceId={workspaceId}
          webhook={editing}
          teams={teams}
          onClose={() => setEditing(undefined)}
          onSecret={setSecret}
        />
      ) : null}
      {secret ? (
        <WebhookSecretDialog secret={secret} onClose={() => setSecret(null)} />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title={t("settings:workspaceWebhooks.deleteTitle")}
        confirmLabel={t("common:actions.delete")}
        pending={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            setDeleting(null);
          } catch {
            return;
          }
        }}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      />
    </SettingsPage>
  );
}
