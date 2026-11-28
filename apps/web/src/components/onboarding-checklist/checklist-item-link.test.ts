import { describe, expect, it } from "vite-plus/test";
import { type Checklist, checklistItemLink } from "./checklist-item-link";

const items: Checklist["items"] = [
  { id: "set-status", done: false },
  { id: "read-handbook", done: false },
  { id: "say-hello", done: false },
  { id: "open-sample-ticket", done: false },
  { id: "invite-teammate", done: false },
];

const checklist: Checklist = {
  workspaceId: "ws",
  handbookDocumentId: "doc",
  welcomeChannelId: "chan",
  sampleTask: { id: "task", projectId: "proj" },
  items,
};

describe("checklistItemLink", () => {
  it("links every item into the welcome workspace", () => {
    expect(items.map(({ id }) => checklistItemLink(id, checklist))).toEqual([
      { to: "/dashboard/settings/account/information" },
      {
        to: "/dashboard/workspace/$workspaceId/document/$documentId",
        params: { workspaceId: "ws", documentId: "doc" },
      },
      {
        to: "/dashboard/workspace/$workspaceId/channels/$channelId",
        params: { workspaceId: "ws", channelId: "chan" },
      },
      {
        to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
        params: { workspaceId: "ws", projectId: "proj", taskId: "task" },
      },
      {
        to: "/dashboard/workspace/$workspaceId/members",
        params: { workspaceId: "ws" },
      },
    ]);
  });

  it("keeps only the status link once the workspace is gone", () => {
    const left: Checklist = {
      workspaceId: null,
      handbookDocumentId: null,
      welcomeChannelId: null,
      sampleTask: null,
      items,
    };
    expect(items.map(({ id }) => checklistItemLink(id, left))).toEqual([
      { to: "/dashboard/settings/account/information" },
      null,
      null,
      null,
      null,
    ]);
  });
});
