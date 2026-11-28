import { z } from "../openapi";
import { CHECKLIST_ITEMS, MANUAL_CHECKLIST_ITEMS } from "./items";

export const checklistSchema = z
  .object({
    workspaceId: z.string().nullable().openapi({
      description:
        "The welcome workspace made at sign-up. Null, like the links below, once you are no longer a member of it.",
    }),
    handbookDocumentId: z.string().nullable(),
    welcomeChannelId: z.string().nullable(),
    sampleTask: z.object({ id: z.string(), projectId: z.string() }).nullable(),
    items: z.array(
      z.object({ id: z.enum(CHECKLIST_ITEMS), done: z.boolean() }),
    ),
  })
  .nullable()
  .openapi("OnboardingChecklist", {
    description:
      "Null for people who signed up before the checklist existed, and after it is dismissed.",
  });

export const checklistItemParam = z.object({
  itemId: z.enum(MANUAL_CHECKLIST_ITEMS).openapi({
    param: { name: "itemId", in: "path" },
    description:
      "An item ticked by following its link. 'set-status' is ticked by setting a status.",
  }),
});

export const dismissedSchema = z
  .object({ dismissed: z.literal(true) })
  .openapi("OnboardingChecklistDismissed");

export const welcomeWorkspaceSchema = z
  .object({ workspaceId: z.string().nullable() })
  .openapi("WelcomeWorkspace");
