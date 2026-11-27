import { getDocumentProxy } from "unpdf";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createWorkspaceMember,
  type SeededMemberContext,
} from "./helpers/fixtures";

type User = SeededMemberContext["user"];

const CONTENT = [
  "## Scope",
  "",
  "The export keeps tables.",
  "",
  "| Part | Owner |",
  "| --- | --- |",
  "| API | Team A |",
].join("\n");

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const other = await createWorkspaceMember();
  const ws = owner.workspace.id;
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: ws,
    userId: other.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const [doc] = await db
    .insert(schema.documentTable)
    .values({
      workspaceId: ws,
      title: "Release plan",
      content: CONTENT,
      scope: "private",
      creatorId: owner.user.id,
    })
    .returning();
  const { app } = createApp();
  const as = (user: User | null) => {
    if (user) mockAuthenticatedSession(user);
    else mockAnonymousSession();
    return (format: string, id = doc!.id, workspaceId = ws) =>
      app.request(
        `/api/document/workspace/${workspaceId}/${id}/export?format=${format}`,
      );
  };
  return { ws, doc: doc!, owner: owner.user, other: other.user, as };
}

async function pdfText(bytes: ArrayBuffer) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { items } = await (await pdf.getPage(1)).getTextContent();
  return items.map((item) => ("str" in item ? item.str : ""));
}

describe("API integration: document export", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("exports a document as Markdown with its title and tables", async () => {
    const { owner, as } = await setup();
    const response = await as(owner)("markdown");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="release-plan.md"',
    );
    expect(await response.text()).toBe(`# Release plan\n\n${CONTENT}\n`);
  });

  it("exports a document as a PDF with its headings and table cells", async () => {
    const { owner, as } = await setup();
    const response = await as(owner)("pdf");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="release-plan.pdf"',
    );
    const text = await pdfText(await response.arrayBuffer());
    for (const expected of [
      "Release plan",
      "Scope",
      "Part",
      "Owner",
      "API",
      "Team A",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("refuses a document the reader cannot open, as if it were missing", async () => {
    const { other, as } = await setup();
    for (const format of ["markdown", "pdf"]) {
      expect((await as(other)(format)).status).toBe(404);
    }
  });

  it("refuses a document from another workspace", async () => {
    const { doc, as } = await setup();
    const stranger = await createWorkspaceMember({ role: "owner" });
    const response = await as(stranger.user)(
      "markdown",
      doc.id,
      stranger.workspace.id,
    );
    expect(response.status).toBe(404);
    expect((await as(stranger.user)("markdown")).status).toBe(404);
  });

  it("refuses a signed-out caller and an unknown format", async () => {
    const { owner, as } = await setup();
    expect((await as(null)("markdown")).status).toBe(401);
    expect((await as(owner)("docx")).status).toBe(400);
  });
});
