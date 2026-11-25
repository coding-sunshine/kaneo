import type { ZodType } from "zod";
import { createRoute, errorResponse, jsonResponse, z } from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createSlotBody,
  slotListSchema,
  slotSchema,
  topicParam,
  topicSlotParam,
} from "./schema";

const tags = ["Topics"];
const slots = "/workspace/{workspaceId}/{id}/slots";
const notFound = errorResponse("Topic or slot not found");
const notOwner = errorResponse(
  "Only the topic's decider or a workspace owner can change its slots",
);
const body = <T extends ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["read"] }),
] as const;
const write = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ task: ["update"] }),
] as const;

export const listSlotsRoute = createRoute({
  method: "get",
  operationId: "listTopicSlots",
  path: slots,
  tags,
  summary: "List a topic's slots",
  description:
    "The facts a topic keeps, such as a launch date or a price. Documents filed on the topic state values for them.",
  middleware: [...read] as const,
  request: { params: topicParam },
  responses: {
    200: jsonResponse("Slots", slotListSchema),
    404: notFound,
  },
});

export const createSlotRoute = createRoute({
  method: "post",
  operationId: "createTopicSlot",
  path: slots,
  tags,
  summary: "Add a slot to a topic",
  description:
    "Name a fact the topic keeps and how its values are compared. For the decider and workspace owners.",
  middleware: [...write] as const,
  request: { params: topicParam, body: body(createSlotBody) },
  responses: {
    200: jsonResponse("Slot added", slotSchema),
    400: errorResponse("A key in the wrong form, or an enum without options"),
    403: notOwner,
    404: notFound,
    409: errorResponse("The topic already has a slot with that key"),
  },
});

export const deleteSlotRoute = createRoute({
  method: "delete",
  operationId: "deleteTopicSlot",
  path: `${slots}/{slotId}`,
  tags,
  summary: "Remove a slot from a topic",
  description:
    "Removes the slot and every statement written for it. Refused while an issue or a document relies on one of those statements. For the decider and workspace owners.",
  middleware: [...write] as const,
  request: { params: topicSlotParam },
  responses: {
    200: jsonResponse("Slot removed", z.object({ id: z.string() })),
    403: notOwner,
    404: notFound,
    409: errorResponse("Work relies on a value in this slot"),
  },
});
