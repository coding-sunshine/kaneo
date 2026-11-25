import type { SlotType } from "../database/schema";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const MONTH =
  /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b/;
const CURRENCIES: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "₹": "INR",
};

const plain = (value: string) =>
  value.replace(/\s+/g, " ").trim().toLowerCase();

const two = (part: string | number) => String(part).padStart(2, "0");

// ponytail: a date without a year compares as month and day only, so
// "5 March" and "5 March 2027" count as different values.
function date(value: string) {
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(value);
  if (iso) return `${iso[1]}-${two(iso[2] ?? "")}-${two(iso[3] ?? "")}`;
  const lower = value.toLowerCase();
  const month = MONTH.exec(lower);
  const year = /\b(\d{4})\b/.exec(lower);
  const day = /\b(\d{1,2})(?:st|nd|rd|th)?\b/.exec(
    lower.replace(/\b\d{4}\b/g, " "),
  );
  if (!month?.[1] || !day?.[1]) return null;
  const tail = `${two(MONTHS.indexOf(month[1].slice(0, 3)) + 1)}-${two(day[1])}`;
  return year ? `${year[1]}-${tail}` : tail;
}

function number(value: string) {
  const found = /-?\d[\d,]*(?:\.\d+)?/.exec(value);
  return found ? String(Number(found[0].replaceAll(",", ""))) : null;
}

function money(value: string) {
  const amount = number(value);
  if (amount === null) return null;
  const symbol = /[$€£₹]/.exec(value)?.[0];
  const code = symbol ? CURRENCIES[symbol] : /\b[A-Z]{3}\b/.exec(value)?.[0];
  return code ? `${amount} ${code}` : amount;
}

function bool(value: string) {
  const word = plain(value);
  if (["yes", "true", "on"].includes(word)) return "true";
  if (["no", "false", "off"].includes(word)) return "false";
  return null;
}

/**
 * The form two values of a slot are compared in. Null only when the value
 * cannot be one of the slot's: an `enum` value outside its options, or a
 * `bool` that is neither yes nor no. A date, number or amount that cannot be
 * read is kept as lower-case text, so it still differs from any other.
 */
export function normalizeValue(
  type: SlotType,
  value: string,
  options?: string[] | null,
): string | null {
  const text = plain(value);
  if (!text) return null;
  if (type === "bool") return bool(value);
  if (type === "enum") {
    return (options ?? []).map(plain).find((option) => option === text) ?? null;
  }
  if (type === "date") return date(value) ?? text;
  if (type === "number") return number(value) ?? text;
  if (type === "money") return money(value) ?? text;
  return text;
}
