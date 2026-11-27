import { describe, expect, it } from "vite-plus/test";
import { addressedTokens, readEmailIntakeConfig } from "./config";

const config = readEmailIntakeConfig({
  EMAIL_INTAKE_ADDRESS: "help@intake.example.test",
  EMAIL_INTAKE_POP3_HOST: "127.0.0.1",
  EMAIL_INTAKE_POP3_USER: "intake",
  EMAIL_INTAKE_POP3_PASSWORD: "fake-password",
});

describe("addressedTokens", () => {
  it("reads only 128-bit hex tokens from team addresses", () => {
    if (!config) throw new Error("config should be on");
    const token = "0123456789abcdef0123456789abcdef";
    expect(
      addressedTokens(config, [
        `help+${token}@intake.example.test`,
        "help+help-0123456789@intake.example.test",
        `other+${token}@intake.example.test`,
        `help+${token}@elsewhere.example.test`,
      ]),
    ).toEqual([token]);
  });

  it("is off when a mailbox setting is missing", () => {
    expect(
      readEmailIntakeConfig({
        EMAIL_INTAKE_ADDRESS: "help@intake.example.test",
      }),
    ).toBeNull();
  });
});
