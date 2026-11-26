import { expect, it } from "vite-plus/test";
import type { Slot } from "../topic/controllers/slots";
import {
  keptStatements,
  numbered,
  taskAnswerSchema,
  taskQuestion,
} from "./task-question";

const slot = (id: string, topicId: string, type: Slot["type"]): Slot => ({
  id,
  topicId,
  key: "price",
  name: `Price of ${topicId}`,
  type,
  options: null,
  createdBy: null,
  createdAt: new Date(0),
});
// Two topics with the same slot key: the key cannot name a slot in a question.
const asked = numbered([
  { id: "lease", name: "Office lease", slots: [slot("a", "lease", "number")] },
  { id: "car", name: "Car lease", slots: [slot("b", "car", "bool")] },
]);
const TEXT = "The office rent is 4200 a month. The car costs 300.";
const said = (
  topic: string,
  slotRef: string,
  value: string,
  quote: string,
) => ({
  topics: [{ topic, names_it: "the office" }],
  statements: [{ slot: slotRef, about: "x", value, quote }],
});

it("names topics and slots apart, also when two slots share a key", () => {
  expect(asked.map(({ ref, slots }) => [ref, slots.map((s) => s.ref)])).toEqual(
    [
      ["t1", ["s1"]],
      ["t2", ["s2"]],
    ],
  );
  const question = taskQuestion(asked, TEXT);
  expect(question).toContain("Topic t1: Office lease\n- s1 (number): Price");
  expect(question).toContain("Topic t2: Car lease\n- s2 (bool): Price");
  expect(question.endsWith(`Ticket:\n${TEXT}`)).toBe(true);
  expect(JSON.stringify(taskAnswerSchema(asked))).toContain('["s1","s2"]');
});

it("keeps a statement on a slot of a topic the answer names", () => {
  expect(
    keptStatements(asked, said("t1", "s1", "4200", "rent is 4200"), TEXT),
  ).toEqual([
    { slotId: "a", value: "4200", normalized: "4200", quote: "rent is 4200" },
  ]);
});

it("drops a statement on a topic the answer did not name", () => {
  expect(
    keptStatements(asked, said("t1", "s2", "300", "car costs 300"), TEXT),
  ).toEqual([]);
});

it("drops a quote that is not in the text, and a value the slot refuses", () => {
  expect(
    keptStatements(asked, said("t1", "s1", "4200", "rent was 4200"), TEXT),
  ).toEqual([]);
  // A yes-or-no slot takes yes or no.
  expect(
    keptStatements(asked, said("t2", "s2", "maybe", "car costs 300"), TEXT),
  ).toEqual([]);
});

it("reads no answer from something that is not the two lists", () => {
  expect(keptStatements(asked, null, TEXT)).toBeNull();
  expect(keptStatements(asked, { statements: [] }, TEXT)).toBeNull();
});
