import type { OnboardingChecklist } from "@/fetchers/onboarding/get-onboarding-checklist";

export type Checklist = NonNullable<OnboardingChecklist>;
export type ChecklistItemId = Checklist["items"][number]["id"];

// Where each item sends the person. Items that point into the welcome
// workspace have no link once the person is no longer in it.
export function checklistItemLink(item: ChecklistItemId, checklist: Checklist) {
  const { workspaceId, handbookDocumentId, welcomeChannelId, sampleTask } =
    checklist;
  switch (item) {
    case "set-status":
      return { to: "/dashboard/settings/account/information" } as const;
    case "read-handbook":
      return workspaceId && handbookDocumentId
        ? ({
            to: "/dashboard/workspace/$workspaceId/document/$documentId",
            params: { workspaceId, documentId: handbookDocumentId },
          } as const)
        : null;
    case "say-hello":
      return workspaceId && welcomeChannelId
        ? ({
            to: "/dashboard/workspace/$workspaceId/channels/$channelId",
            params: { workspaceId, channelId: welcomeChannelId },
          } as const)
        : null;
    case "open-sample-ticket":
      return workspaceId && sampleTask
        ? ({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId,
              projectId: sampleTask.projectId,
              taskId: sampleTask.id,
            },
          } as const)
        : null;
    case "invite-teammate":
      return workspaceId
        ? ({
            to: "/dashboard/workspace/$workspaceId/members",
            params: { workspaceId },
          } as const)
        : null;
  }
}
