import { describe, expect, it } from "vite-plus/test";
import { dropRawIds } from "./drop-raw-ids";

const c = "k3j9x2m8q7w1e5r4t6y0u2i8";
const t = "a1b2c3d4e5f6g7h8i9j0k1l2";

describe("dropRawIds", () => {
  it("takes out the ids a model writes into its text, with their brackets", () => {
    expect(dropRawIds(`Blocked on the vendor (comment:${c}).`, [c])).toBe(
      "Blocked on the vendor.",
    );
    expect(dropRawIds(`See [${c}, ${t}] for details`, [c, t])).toBe(
      "See for details",
    );
    expect(dropRawIds(`As comment ${c} says, it waits.`, [c])).toBe(
      "As comment says, it waits.",
    );
  });

  it("takes out a kind:id token even when the id was not given", () => {
    expect(dropRawIds(`Waits on task:${t} now`, [])).toBe("Waits on now");
  });

  it("changes nothing else when no id is given", () => {
    expect(dropRawIds("A  b, c.\n\nd", [])).toBe("A b, c.\n\nd");
  });

  it("keeps ticket keys, short words and line breaks", () => {
    expect(dropRawIds("PAY-1 waits.\n\n- Retry first", ["PAY-1"])).toBe(
      "PAY-1 waits.\n\n- Retry first",
    );
  });
});
