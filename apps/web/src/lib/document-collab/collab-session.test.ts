import * as Y from "yjs";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { collabRegistry } from "./collab-registry";
import { HttpError } from "@/lib/http-error";
import { CollabSession } from "./collab-session";
import { createFakeCollabServer } from "./fake-collab-server";

const seedParagraph = (doc: Y.Doc, markdown: string) => {
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(markdown)]);
  doc.getXmlFragment("default").insert(0, [paragraph]);
};
const text = (session: CollabSession) =>
  (
    (session.doc.getXmlFragment("default").get(0) as Y.XmlElement).get(
      0,
    ) as Y.XmlText
  ).toString();

const open: Array<() => void> = [];
function join(server: ReturnType<typeof createFakeCollabServer>) {
  const session = new CollabSession(server.transport, seedParagraph);
  const remove = collabRegistry.add("doc-1", session);
  open.push(() => {
    remove();
    session.destroy();
  });
  return session;
}

afterEach(() => {
  for (const close of open.splice(0)) close();
  vi.useRealTimers();
});

describe("CollabSession", () => {
  it("seeds once when two people open an unseeded document together", async () => {
    const server = createFakeCollabServer("doc-1", "Plan");
    const [a, b] = [join(server), join(server)];
    await Promise.all([a.start(), b.start()]);
    expect([a.status, b.status]).toEqual(["ready", "ready"]);
    expect(a.doc.getXmlFragment("default").length).toBe(1);
    expect(b.doc.getXmlFragment("default").length).toBe(1);
    expect([text(a), text(b)]).toEqual(["Plan", "Plan"]);
  });

  it("keeps both people's typing in the same paragraph", async () => {
    vi.useFakeTimers();
    const server = createFakeCollabServer("doc-1", "Hello");
    const a = join(server);
    await a.start();
    const b = join(server);
    await b.start();

    const paragraph = (session: CollabSession) =>
      (session.doc.getXmlFragment("default").get(0) as Y.XmlElement).get(
        0,
      ) as Y.XmlText;
    // Same place, before either send goes out.
    paragraph(a).insert(5, " Ada");
    paragraph(b).insert(5, " Grace");
    await vi.advanceTimersByTimeAsync(200);

    expect(text(a)).toBe(text(b));
    expect(text(a)).toContain(" Ada");
    expect(text(a)).toContain(" Grace");
    expect(text(a)).toHaveLength("Hello Ada Grace".length);
  });

  it("shows the other person's cursor, and drops it when they leave", async () => {
    vi.useFakeTimers();
    const server = createFakeCollabServer("doc-1", "Hi");
    const a = join(server);
    await a.start();
    const b = join(server);
    await b.start();

    a.awareness.setLocalStateField("user", { name: "Ada" });
    await vi.advanceTimersByTimeAsync(100);
    expect(b.awareness.getStates().get(a.doc.clientID)).toEqual({
      user: { name: "Ada" },
    });

    open.shift()?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(b.awareness.getStates().has(a.doc.clientID)).toBe(false);
  });

  it("asks for a new session when someone starts over from another text", async () => {
    const server = createFakeCollabServer("doc-1", "Hi");
    const a = join(server);
    await a.start();
    collabRegistry.deliver({
      type: "DOCUMENT_COLLAB_RESET",
      documentId: "doc-1",
    });
    expect(a.status).toBe("stale");
  });

  it("reports a failure it cannot recover from", async () => {
    const server = createFakeCollabServer("doc-1", "Hi");
    server.transport.load = async () => {
      throw new Error("offline");
    };
    const a = join(server);
    await a.start();
    expect(a.status).toBe("failed");
  });
  it("catches up on a change it missed while the socket was down", async () => {
    vi.useFakeTimers();
    const server = createFakeCollabServer("doc-1", "Hi");
    const a = join(server);
    await a.start();
    const b = join(server);
    await b.start();
    const paragraph = (session: CollabSession) =>
      (session.doc.getXmlFragment("default").get(0) as Y.XmlElement).get(
        0,
      ) as Y.XmlText;

    server.dropNext();
    paragraph(a).insert(2, " there");
    await vi.advanceTimersByTimeAsync(100);
    expect(text(b)).toBe("Hi");
    // The next change depends on the lost one; Yjs holds it back.
    paragraph(a).insert(8, "!");
    await vi.advanceTimersByTimeAsync(100);
    expect(text(b)).toBe("Hi");

    // The socket is back: every open session reloads the stored state.
    await collabRegistry.resync();
    expect(text(b)).toBe("Hi there!");
  });

  it("stops sending, and says so, when the server refuses a change for good", async () => {
    vi.useFakeTimers();
    const server = createFakeCollabServer("doc-1", "Hi");
    const a = join(server);
    await a.start();
    const send = vi
      .spyOn(server.transport, "send")
      .mockRejectedValue(new HttpError(403, "no", { code: "FORBIDDEN" }));
    (
      (a.doc.getXmlFragment("default").get(0) as Y.XmlElement).get(
        0,
      ) as Y.XmlText
    ).insert(0, "x");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(a.status).toBe("failed");
  });

  it("retries a change the network lost", async () => {
    vi.useFakeTimers();
    const server = createFakeCollabServer("doc-1", "Hi");
    const a = join(server);
    await a.start();
    const real = server.transport.send;
    const send = vi
      .spyOn(server.transport, "send")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(real);
    (
      (a.doc.getXmlFragment("default").get(0) as Y.XmlElement).get(
        0,
      ) as Y.XmlText
    ).insert(0, "x");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(a.status).toBe("ready");
  });
});
