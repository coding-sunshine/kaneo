import { HTTPException } from "hono/http-exception";
import { resolveCitations } from "../agent/resolve-citations";
import { dropRanking } from "../assist/drop-ranking";
import { BULLETS_INSTRUCTION, readBullets } from "../assist/read-bullets";
import { runModel } from "../assist/run-model";
import { gatherMissedMessages } from "./gather-messages";
import { gatherFollowedTicketEvents } from "./gather-ticket-events";
import { getCatchUpPreference } from "./preference";

type Reader = Parameters<typeof resolveCitations>[0];
const MAX_CHARS = 500;

export type MessageCitation = {
  kind: "message";
  restricted: false;
  id: string;
  channelId: string;
  channelName: string;
};

const SYSTEM = [
  "You write a private catch-up for one person who was away: what changed in their unread channels, their threads and the tickets they follow.",
  "Lead with decisions, questions waiting on them and changes to their work. Group related items. At most 12 bullets.",
  BULLETS_INSTRUCTION,
].join("\n");

/**
 * The reader's catch-up over the last `hours`: nothing is stored or sent, so
 * it exists only in their response. Each bullet links to the messages or
 * tickets it rests on; bullets that rank people are dropped.
 */
export async function catchUp(reader: Reader, hours: number) {
  const { workspaceId, userId } = reader;
  const since = new Date(Date.now() - hours * 3_600_000);
  const { includeDirectMessages } = await getCatchUpPreference(reader);
  const [messages, events] = await Promise.all([
    gatherMissedMessages(workspaceId, userId, since, includeDirectMessages),
    reader.mayReadTasks
      ? gatherFollowedTicketEvents(workspaceId, userId, since)
      : Promise.resolve([]),
  ]);
  if (messages.length === 0 && events.length === 0) return { bullets: [] };

  const data = [
    ...messages.map(
      (m) =>
        `<message id="${m.id}" channel=${JSON.stringify(m.channelName)}${m.threadId ? ` thread="${m.threadId}"` : ""} author=${JSON.stringify(m.author ?? "")} at="${m.createdAt.toISOString()}">${m.body.slice(0, MAX_CHARS)}</message>`,
    ),
    ...events.map(
      (e) =>
        `<ticket-event id="${e.id}" type="${e.type}" ticket=${JSON.stringify(e.title)} at="${e.createdAt.toISOString()}">${(e.content ?? "").slice(0, MAX_CHARS)}</ticket-event>`,
    ),
  ].join("\n");
  const result = await runModel({ workspaceId, userId, purpose: "catch-up" }, [
    { role: "system", content: SYSTEM },
    { role: "user", content: data },
  ]);

  const byMessage = new Map(messages.map((m) => [m.id, m]));
  const byEvent = new Map(events.map((e) => [e.id, e]));
  const bullets = readBullets(
    result.content,
    new Set([...byMessage.keys(), ...byEvent.keys()]),
  );
  if (!bullets)
    throw new HTTPException(502, {
      message: "The catch-up could not be read. Try again.",
    });

  const cite = async (id: string) => {
    const message = byMessage.get(id);
    if (message)
      return {
        kind: "message" as const,
        restricted: false as const,
        id: message.threadId ?? message.id,
        channelId: message.channelId,
        channelName: message.channelName,
      };
    const event = byEvent.get(id);
    const [citation] = await resolveCitations(
      reader,
      event?.type === "comment"
        ? [{ kind: "comment", id }]
        : [{ kind: "task", id: event?.taskId ?? id }],
    );
    return citation;
  };
  return {
    bullets: await Promise.all(
      dropRanking(bullets).map(async (bullet) => ({
        text: bullet.text,
        sources: (await Promise.all(bullet.sources.map(cite))).filter(
          (source) => source !== undefined,
        ),
      })),
    ),
  };
}
