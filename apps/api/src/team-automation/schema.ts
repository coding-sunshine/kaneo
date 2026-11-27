import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const slaSettingsBody = z.object({
  slaEnabled: z.boolean().optional(),
  slaUrgentHours: z.number().int().min(1).max(8760).optional(),
  slaHighHours: z.number().int().min(1).max(8760).optional(),
});

export const triageResponsibilityBody = z.object({
  mode: z.enum(["notify", "assign"]),
  userIds: z.array(z.string()).max(50),
});

export const triageResponsibilitySchema = z
  .object({
    mode: z.enum(["notify", "assign"]),
    userIds: z.array(z.string()),
  })
  .openapi("TriageResponsibility");

export const itIntakeSchema = z
  .object({
    columnId: z.string().openapi({ description: "The Triage status." }),
    fieldId: z.string().openapi({ description: "The Category custom field." }),
    templateId: z.string().openapi({ description: "The IT request template." }),
    viewId: z.string().openapi({ description: "The IT queue saved view." }),
  })
  .openapi("ItIntake");
