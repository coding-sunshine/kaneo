import { listTopics } from "./get-topic";

// Lowercase words of letters and digits with a space at each end, so one
// phrase can be looked for inside another on whole words.
const phrase = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;

// The topics the person can open that a text names: one by its id, or any
// whose name is in the text or has the text in it. A topic they cannot open
// is never among them, so it reads like a topic that does not exist.
// ponytail: whole words of the name only. Matching on what a topic's
// documents say belongs to a later step.
export async function findTopics(
  workspaceId: string,
  userId: string,
  text: string,
) {
  const wanted = phrase(text);
  // A text with no letters or digits would be inside every name.
  const named = wanted.trim() !== "";
  return (await listTopics(workspaceId, userId)).filter((topic) => {
    if (topic.id === text) return true;
    if (!named) return false;
    const name = phrase(topic.name);
    return wanted.includes(name) || name.includes(wanted);
  });
}
