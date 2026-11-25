import { describe, expect, it } from "vite-plus/test";
import { fingerprint, resemblance } from "./fingerprint";

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
// The plan with the sentences at `positions` written anew.
const revised = (...positions: number[]) =>
  SENTENCES.map((sentence, index) =>
    positions.includes(index) ? REWORDED[positions.indexOf(index)] : sentence,
  ).join(" ");
const PLAN = SENTENCES.join(" ");

describe("fingerprint", () => {
  it("has one entry for each distinct run of five words", () => {
    expect(fingerprint("")).toEqual([]);
    expect(fingerprint("one two three four")).toEqual([]);
    expect(fingerprint("one two three four five")).toHaveLength(1);
    expect(fingerprint("one two three four five six")).toHaveLength(2);
    // The sixth run repeats the first.
    expect(fingerprint("a b c d e a b c d e")).toHaveLength(5);
  });

  it("is a sorted list of whole numbers that fit an integer column", () => {
    const prints = fingerprint(PLAN);
    expect(prints.length).toBeGreaterThan(100);
    expect(prints).toEqual([...prints].sort((a, b) => a - b));
    for (const print of prints) {
      expect(Number.isInteger(print)).toBe(true);
      expect(Math.abs(print)).toBeLessThanOrEqual(2 ** 31);
    }
  });

  it("reads the words, not the way they are written down", () => {
    const html = SENTENCES.map((sentence) => `<p>${sentence}</p>`).join("");
    const markdown = SENTENCES.map(
      (sentence) => `- **${sentence.toUpperCase()}**`,
    ).join("\n\n");

    expect(fingerprint(html)).toEqual(fingerprint(PLAN));
    expect(fingerprint(markdown)).toEqual(fingerprint(PLAN));
    expect(
      fingerprint(`<p class="five words sit in here now">${PLAN}</p>`),
    ).toEqual(fingerprint(PLAN));
    expect(fingerprint("<p>one two &amp;&nbsp;three four five</p>")).toEqual(
      fingerprint("one two & three four five"),
    );
  });

  it("tells the order of the words apart", () => {
    expect(fingerprint("one two three four five")).not.toEqual(
      fingerprint("five four three two one"),
    );
  });
});

describe("resemblance", () => {
  it("is the share of runs two texts have in common", () => {
    const plan = fingerprint(PLAN);

    expect(resemblance(plan, plan)).toBe(1);
    expect(resemblance(plan, fingerprint(REWORDED.join(" ")))).toBe(0);
    expect(resemblance(plan, [])).toBe(0);
    expect(resemblance([], [])).toBe(0);
    // Two of three runs out of four in all.
    expect(resemblance([1, 2, 3], [2, 3, 4])).toBe(0.5);
  });

  it("puts a revision above one half and another text below it", () => {
    const plan = fingerprint(PLAN);
    const light = resemblance(plan, fingerprint(revised(3)));
    const heavy = resemblance(plan, fingerprint(revised(0, 2, 4, 6, 8, 9)));

    expect(light).toBeGreaterThan(0.5);
    expect(light).toBeLessThan(1);
    expect(heavy).toBeLessThan(0.5);
    expect(resemblance(fingerprint(revised(3)), plan)).toBe(light);
  });
});
