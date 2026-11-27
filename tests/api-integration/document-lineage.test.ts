import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { documentLineageTable } from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];
type Link = { id: string; title: string; overlap: number; status: string };
type Detail = {
  id: string;
  status: string;
  kind: string;
  revisionOf: Link | null;
};

const SENTENCES = [
  "The launch moves to the first week of March because the audit slipped.",
  "Pricing stays at three tiers and the middle tier keeps its annual discount.",
  "Support hours extend to weekends for the first month after release.",
  "The onboarding email sequence drops from seven messages to four.",
  "Every enterprise contract gets a named contact inside the success team.",
  "Billing switches to usage based invoices at the start of the next quarter.",
  "The mobile app ships two weeks after the web release, not together with it.",
  "Legal reviews the new terms before any customer sees the upgrade prompt.",
  "The beta group grows from forty accounts to one hundred and twenty.",
  "Marketing holds the announcement until the status page shows no incidents.",
];
const REWORDED = [
  "Nobody has picked a date yet, so the calendar entry is only a placeholder.",
  "Finance wants one flat price and will bring numbers to the Tuesday review.",
  "Phones are answered on working days between nine and five as before.",
  "New accounts receive a single welcome note and a link to the handbook.",
  "Large customers share a queue that the whole success group watches.",
  "Invoices keep their monthly rhythm and their fixed amount per seat.",
];
// The plan as HTML, with the sentences at `positions` written anew.
const revised = (...positions: number[]) =>
  SENTENCES.map((sentence, index) =>
    positions.includes(index) ? REWORDED[positions.indexOf(index)] : sentence,
  )
    .map((sentence) => `<p>${sentence}</p>`)
    .join("");
const PLAN = revised();
const ONE_CHANGE = revised(3);
const OTHER_TEXT = revised(0, 2, 4, 6, 8, 9);
const DAY = 86_400_000;

const base = (world: DocumentWorld) => `/document/workspace/${world.ws}`;
const write = async (
  world: DocumentWorld,
  author: Member,
  title: string,
  content: string | undefined,
  parent: Record<string, string> = {},
) => {
  const response = await world.as(author)(
    "/document",
    json("POST", { workspaceId: world.ws, title, content, ...parent }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
};
const edit = async (
  world: DocumentWorld,
  user: Member,
  id: string,
  content: string,
) => {
  const response = await world.as(user)(
    `${base(world)}/${id}`,
    json("PATCH", { content }),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as Detail;
};
const detail = async (world: DocumentWorld, user: Member, id: string) => {
  const response = await world.as(user)(`${base(world)}/${id}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Detail;
};
const link = async (world: DocumentWorld, user: Member, id: string) =>
  (await detail(world, user, id)).revisionOf;
const decide = (
  world: DocumentWorld,
  user: Member,
  id: string,
  status: unknown,
) => world.as(user)(`${base(world)}/${id}/lineage`, json("PUT", { status }));
const save = async (
  world: DocumentWorld,
  user: Member,
  markdown: string,
  idempotencyKey: string,
) => {
  const response = await world.as(user)(
    "/document/file",
    json("POST", {
      workspaceId: world.ws,
      title: "From a chat",
      markdown,
      idempotencyKey,
    }),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    id: string;
    created: boolean;
    revisionOf: Link | null;
  };
};
const rows = () =>
  db
    .select({
      documentId: documentLineageTable.documentId,
      sourceDocumentId: documentLineageTable.sourceDocumentId,
    })
    .from(documentLineageTable);
const set = (
  id: string,
  values: Partial<typeof schema.documentTable.$inferInsert>,
) =>
  db
    .update(schema.documentTable)
    .set(values)
    .where(eq(schema.documentTable.id, id));

describe("API integration: draft lineage", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("proposes the older document that a text resembles", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const team = { projectId: world.alpha.id };
    const plan = await write(world, owner, "Launch plan", PLAN, team);
    const other = await write(world, owner, "Other", OTHER_TEXT, team);
    const copy = await write(world, owner, "Launch plan v2", ONE_CHANGE, team);

    const proposed = await link(world, owner, copy);
    expect(proposed).toEqual({
      id: plan,
      title: "Launch plan",
      overlap: expect.any(Number),
      status: "proposed",
    });
    expect(proposed?.overlap).toBeGreaterThan(50);
    expect(proposed?.overlap).toBeLessThan(100);
    // The older one is not a revision of the newer one, also after an edit.
    expect(await link(world, owner, plan)).toBeNull();
    expect((await edit(world, owner, plan, revised(9))).revisionOf).toBeNull();
    expect(await link(world, owner, other)).toBeNull();

    // A text that is typed in later is compared when it is saved, and of two
    // older documents the closer one is named.
    const typed = await write(world, owner, "Typed", undefined, team);
    expect(await link(world, owner, typed)).toBeNull();
    expect(
      (await edit(world, owner, typed, ONE_CHANGE)).revisionOf,
    ).toMatchObject({ id: copy, overlap: 100 });
    // A proposal follows the text: reworked far enough, it is gone.
    expect((await edit(world, owner, typed, OTHER_TEXT)).revisionOf?.id).toBe(
      other,
    );
    // Not the six rewritten sentences alone: those are most of OTHER_TEXT.
    const unrelated =
      "<p>Lunch orders for the offsite go to the front desk by Friday noon.</p>";
    expect((await edit(world, owner, typed, unrelated)).revisionOf).toBeNull();
    expect(await rows()).toEqual([
      { documentId: copy, sourceDocumentId: plan },
    ]);
  });

  // The threshold is 0.30 of all five-word runs. Of ten sentences, three
  // rewritten share 0.45 and five rewritten 0.20.
  it("proposes a text with three of ten sentences rewritten, not five", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const team = { projectId: world.alpha.id };
    const plan = await write(world, owner, "Launch plan", PLAN, team);

    const draft = await write(
      world,
      owner,
      "Rewritten",
      revised(0, 2, 4, 6, 8),
      team,
    );
    expect(await link(world, owner, draft)).toBeNull();
    expect(
      (await edit(world, owner, draft, revised(0, 2, 4))).revisionOf,
    ).toMatchObject({ id: plan, overlap: 44 });
  });

  it("names the document in the receipt of a saved draft", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const plan = await write(world, owner, "Launch plan", PLAN, {
      projectId: world.alpha.id,
    });

    const receipt = await save(world, owner, SENTENCES.join("\n\n"), "one");
    expect(receipt.revisionOf).toMatchObject({
      id: plan,
      title: "Launch plan",
      overlap: 100,
      status: "proposed",
    });
    const again = await save(world, owner, SENTENCES.join("\n\n"), "one");
    expect(again.created).toBe(false);
    expect(again.revisionOf).toEqual(receipt.revisionOf);
    expect(
      (await save(world, owner, REWORDED.join("\n\n"), "two")).revisionOf,
    ).toBeNull();
  });

  it("names only a document the author can open", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    // Team Beta: `limited` cannot open it.
    const secret = { projectId: world.beta.id };
    const plan = await write(world, owner, "Secret plan", ONE_CHANGE, secret);
    await write(world, owner, "Secret other", OTHER_TEXT, secret);
    const twin = await write(world, owner, "Secret twin", revised(5), secret);

    const mine = await write(world, limited, "My plan", ONE_CHANGE);
    expect(await link(world, limited, mine)).toBeNull();
    expect(
      (await save(world, limited, OTHER_TEXT, "one")).revisionOf,
    ).toBeNull();
    // Nothing is kept either: the only link is the one between the two
    // hidden documents, which their author got.
    expect(await rows()).toEqual([
      { documentId: twin, sourceDocumentId: plan },
    ]);

    // A document they can open is named, though a hidden one is closer.
    const visible = await write(world, owner, "Open plan", revised(3, 5), {
      projectId: world.alpha.id,
    });
    const second = await write(world, limited, "My second plan", revised(5));
    expect((await link(world, limited, second))?.id).toBe(visible);
  });

  it("shows the link only to a reader who can open the other document", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    const notes = await write(world, owner, "Private notes", PLAN);
    const shared = await write(world, owner, "Launch plan", ONE_CHANGE, {
      projectId: world.alpha.id,
    });
    const plain = await write(world, owner, "Other", OTHER_TEXT, {
      projectId: world.alpha.id,
    });
    expect((await link(world, owner, shared))?.id).toBe(notes);

    // `limited` reads the shared document, not the author's private notes.
    expect(await link(world, limited, shared)).toBeNull();
    const nothing = await decide(world, limited, plain, "confirmed");
    const hidden = await decide(world, limited, shared, "confirmed");
    expect(nothing.status).toBe(404);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await nothing.json());
    expect((await link(world, owner, shared))?.status).toBe("proposed");

    expect((await decide(world, owner, shared, "confirmed")).status).toBe(200);
    expect(await link(world, limited, shared)).toBeNull();
  });

  it("lets somebody who can edit confirm or dismiss the link, and changes nothing else", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited } = world;
    const team = { projectId: world.alpha.id };
    const plan = await write(world, owner, "Launch plan", PLAN, team);
    const copy = await write(world, owner, "Launch plan v2", ONE_CHANGE, team);
    const third = await write(world, owner, "Launch plan v3", revised(5), team);
    const before = await detail(world, limited, copy);

    // Unknown and hidden answer alike; reading is not enough to decide.
    const unknown = await decide(world, limited, "nope", "confirmed");
    const hidden = await decide(
      world,
      limited,
      world.docs.teamBeta,
      "confirmed",
    );
    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual(await unknown.json());
    expect(
      (await decide(world, limited, world.docs.sharedInBeta, "confirmed"))
        .status,
    ).toBe(403);
    expect((await decide(world, limited, copy, "proposed")).status).toBe(400);
    expect((await decide(world, limited, copy, "maybe")).status).toBe(400);
    expect((await link(world, owner, copy))?.status).toBe("proposed");

    const confirmed = await decide(world, limited, copy, "confirmed");
    expect(confirmed.status).toBe(200);
    const after = (await confirmed.json()) as Detail;
    expect(after.revisionOf).toEqual({
      ...before.revisionOf,
      status: "confirmed",
    });
    // A link never changes what a document is.
    expect(after).toEqual({ ...before, revisionOf: after.revisionOf });
    expect((await detail(world, owner, plan)).status).toBe("draft");
    // Nor the link of any other document.
    expect((await link(world, owner, third))?.status).toBe("proposed");

    // What a person decided stays, whatever the text does next.
    expect(
      (await edit(world, owner, copy, OTHER_TEXT)).revisionOf,
    ).toMatchObject({ id: plan, status: "confirmed" });

    const dismissed = await decide(world, owner, copy, "dismissed");
    expect(dismissed.status).toBe(200);
    expect(((await dismissed.json()) as Detail).revisionOf).toMatchObject({
      id: plan,
      status: "dismissed",
    });
    expect(
      (await edit(world, owner, copy, ONE_CHANGE)).revisionOf,
    ).toMatchObject({ id: plan, status: "dismissed" });
    // And back.
    expect((await decide(world, owner, copy, "confirmed")).status).toBe(200);
    expect((await link(world, owner, copy))?.status).toBe("confirmed");
  });

  it("compares with the documents of the last 90 days in this workspace that are not deleted", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const team = { projectId: world.alpha.id };
    const plan = await write(world, owner, "Launch plan", PLAN, team);

    await set(plan, { updatedAt: new Date(Date.now() - 91 * DAY) });
    const late = await write(world, owner, "Late", ONE_CHANGE, team);
    expect(await link(world, owner, late)).toBeNull();
    await set(plan, { updatedAt: new Date(Date.now() - 89 * DAY) });
    const inTime = await write(world, owner, "In time", revised(4), team);
    expect((await link(world, owner, inTime))?.id).toBe(plan);

    // A deleted document is not named, before or after the proposal.
    for (const id of [plan, late]) {
      const deleted = await world.as(owner)(
        `${base(world)}/${id}`,
        json("DELETE"),
      );
      expect(deleted.status).toBe(200);
    }
    expect(await link(world, owner, inTime)).toBeNull();
    expect((await decide(world, owner, inTime, "confirmed")).status).toBe(404);
    const afterwards = await write(
      world,
      owner,
      "Afterwards",
      revised(5),
      team,
    );
    expect((await link(world, owner, afterwards))?.id).toBe(inTime);

    // The same text in another workspace is nobody's revision here.
    const elsewhere = await buildDocumentWorld();
    const foreign = await write(elsewhere, elsewhere.owner, "Theirs", PLAN, {
      projectId: elsewhere.alpha.id,
    });
    expect(await link(elsewhere, elsewhere.owner, foreign)).toBeNull();
    // Not even for somebody who wrote it there: a link stays in its workspace.
    await set(foreign, { creatorId: owner.id });
    const here = await write(world, owner, "Here", PLAN, team);
    const found = await link(world, owner, here);
    expect([inTime, afterwards]).toContain(found?.id);
    await set(found?.id ?? "", { workspaceId: elsewhere.ws });
    expect(await link(world, owner, here)).toBeNull();
  });

  it("finds a document that was written by SQL, and follows its text", async () => {
    const world = await buildDocumentWorld();
    const { owner } = world;
    const team = { projectId: world.alpha.id };
    // An import writes rows past the API, so they carry no fingerprint.
    const [imported] = await db
      .insert(schema.documentTable)
      .values({
        workspaceId: world.ws,
        title: "Imported plan",
        content: PLAN,
        scope: "team",
        projectId: world.alpha.id,
        creatorId: owner.id,
        createdAt: new Date(Date.now() - DAY),
      })
      .returning({ id: schema.documentTable.id });
    if (!imported) throw new Error("no imported document");

    const copy = await write(world, owner, "Copy", ONE_CHANGE, team);
    expect((await link(world, owner, copy))?.id).toBe(imported.id);

    // The import rewrites the text. The old fingerprint must not answer.
    await set(imported.id, { content: REWORDED.join(" ") });
    const next = await write(world, owner, "Next", PLAN, team);
    expect((await link(world, owner, next))?.id).toBe(copy);
  });

  it("compares again when an older text is restored", async () => {
    const world = await buildDocumentWorld();
    const { owner, open } = world;
    const team = { projectId: world.alpha.id };
    const plan = await write(world, owner, "Launch plan", PLAN, team);
    const draft = await write(world, owner, "Draft", REWORDED.join(" "), team);
    // Another author, so the edit is its own history entry.
    expect((await edit(world, open, draft, ONE_CHANGE)).revisionOf?.id).toBe(
      plan,
    );

    const versions = (await (
      await world.as(owner)(`${base(world)}/${draft}/versions`)
    ).json()) as { id: string }[];
    const restored = await world.as(owner)(
      `${base(world)}/${draft}/versions/${versions.at(-1)?.id}/restore`,
      json("POST"),
    );
    expect(restored.status).toBe(200);
    expect(((await restored.json()) as Detail).revisionOf).toBeNull();
  });
});
