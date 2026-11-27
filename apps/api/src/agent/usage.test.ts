import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

// Rows of ai_usage. The fake database sums the cost of the rows created at or
// after the time the query is given, as `gte(created_at, start)` does.
const rows: { createdAt: Date; cost: number | null }[] = [];

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("drizzle-orm")>()),
  gte: (_column: unknown, since: Date) => ({ since }),
}));

vi.mock("../database", () => ({
  default: {
    select: () => ({
      from: () => ({
        where: async ({ since }: { since: Date }) => [
          {
            spent: rows
              .filter((row) => row.createdAt >= since)
              .reduce((sum, row) => sum + (row.cost ?? 0), 0),
          },
        ],
      }),
    }),
  },
}));

const { monthStart, withinMonthlyCap } = await import("./usage");

const NOW = new Date("2026-11-27T15:00:00Z");

beforeEach(() => {
  rows.length = 0;
  vi.stubEnv("AI_MONTHLY_USD_CAP", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("monthly AI spending cap", () => {
  it("starts the month at midnight UTC on the first", () => {
    expect(monthStart(NOW).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(monthStart(new Date("2027-01-01T00:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("does not count spend from an earlier month against the cap", async () => {
    rows.push(
      { createdAt: new Date("2026-10-31T23:59:59Z"), cost: 50 },
      { createdAt: new Date("2026-11-02T08:00:00Z"), cost: 19.5 },
    );
    expect(await withinMonthlyCap(1, NOW)).toBe(true);
  });

  it("stops the call once this month's spend reaches the 20 USD cap", async () => {
    rows.push(
      { createdAt: new Date("2026-11-01T00:00:00Z"), cost: 12 },
      { createdAt: new Date("2026-11-27T14:00:00Z"), cost: 8 },
    );
    expect(await withinMonthlyCap(1, NOW)).toBe(false);
  });

  it("opens again in the next month", async () => {
    rows.push({ createdAt: new Date("2026-11-27T14:00:00Z"), cost: 20 });
    expect(await withinMonthlyCap(1, new Date("2026-12-01T00:00:01Z"))).toBe(
      true,
    );
  });

  it("reads the cap from AI_MONTHLY_USD_CAP and keeps the reserve share", async () => {
    vi.stubEnv("AI_MONTHLY_USD_CAP", "5");
    rows.push({ createdAt: new Date("2026-11-20T00:00:00Z"), cost: 4 });
    expect(await withinMonthlyCap(1, NOW)).toBe(true);
    expect(await withinMonthlyCap(0.8, NOW)).toBe(false);
  });
});
