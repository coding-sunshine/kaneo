import type { Pop3Options } from "./pop3-client";

export type EmailIntakeConfig = {
  /** The intake mailbox, split so team addresses can be local+token@domain. */
  local: string;
  domain: string;
  pop3: Pop3Options;
};

type Env = Record<string, string | undefined>;

export const EMAIL_INTAKE_ENV_HINT =
  "set EMAIL_INTAKE_ADDRESS, EMAIL_INTAKE_POP3_HOST, EMAIL_INTAKE_POP3_USER and EMAIL_INTAKE_POP3_PASSWORD";

/**
 * Email intake reads one mailbox over POP3. It is off unless the mailbox
 * address and its POP3 login are all set.
 */
export function readEmailIntakeConfig(
  env: Env = process.env,
): EmailIntakeConfig | null {
  const address = env.EMAIL_INTAKE_ADDRESS?.trim().toLowerCase() ?? "";
  const match = /^([^\s@+]+)@([^\s@]+\.[^\s@]+)$/.exec(address);
  const host = env.EMAIL_INTAKE_POP3_HOST?.trim();
  const user = env.EMAIL_INTAKE_POP3_USER?.trim();
  const password = env.EMAIL_INTAKE_POP3_PASSWORD;
  if (!match?.[1] || !match[2] || !host || !user || !password) return null;
  const tls = env.EMAIL_INTAKE_POP3_TLS !== "false";
  const port = Number(env.EMAIL_INTAKE_POP3_PORT) || (tls ? 995 : 110);
  return {
    local: match[1],
    domain: match[2],
    pop3: { host, port, tls, user, password },
  };
}

export function teamIntakeAddress(config: EmailIntakeConfig, token: string) {
  return `${config.local}+${token}@${config.domain}`;
}

/** The team tokens a message is addressed to, from local+token@domain recipients. */
export function addressedTokens(
  config: EmailIntakeConfig,
  recipients: string[],
) {
  const prefix = `${config.local}+`;
  const suffix = `@${config.domain}`;
  return [
    ...new Set(
      recipients
        .filter(
          (address) => address.startsWith(prefix) && address.endsWith(suffix),
        )
        .map((address) => address.slice(prefix.length, -suffix.length))
        .filter((token) => /^[0-9a-f]{32}$/.test(token)),
    ),
  ];
}
