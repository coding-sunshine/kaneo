import { connect as connectTcp, type Socket } from "node:net";
import { connect as connectTls } from "node:tls";

export type Pop3Options = {
  host: string;
  port: number;
  tls: boolean;
  user: string;
  password: string;
  timeoutMs?: number;
  /** A response longer than this ends the session (default: 6 MB). */
  maxResponseBytes?: number;
};

const TERMINATOR = Buffer.from("\r\n.\r\n");

/**
 * A minimal POP3 client (RFC 1939): enough to list, read and delete mail.
 * Deletions only take effect when `quit` succeeds.
 */
export async function openPop3(options: Pop3Options) {
  const socket: Socket = options.tls
    ? connectTls({
        host: options.host,
        port: options.port,
        servername: options.host,
      })
    : connectTcp({ host: options.host, port: options.port });
  socket.setTimeout(options.timeoutMs ?? 30_000, () =>
    socket.destroy(new Error("POP3 connection timed out")),
  );

  let buffer = Buffer.alloc(0);
  let waiter: (() => void) | null = null;
  let failure: Error | null = null;
  const maxBytes = options.maxResponseBytes ?? 6 * 1024 * 1024;
  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > maxBytes) {
      buffer = Buffer.alloc(0);
      socket.destroy(new Error("POP3 response too large"));
    }
    waiter?.();
  });
  const fail = (error: Error) => {
    failure ??= error;
    waiter?.();
  };
  socket.on("error", fail);
  socket.on("close", () => fail(new Error("POP3 connection closed")));

  async function read(multiline: boolean): Promise<Buffer> {
    for (;;) {
      const lineEnd = buffer.indexOf("\r\n");
      if (lineEnd >= 0) {
        const status = buffer.subarray(0, lineEnd).toString("latin1");
        if (!status.startsWith("+OK")) {
          buffer = buffer.subarray(lineEnd + 2);
          throw new Error(`POP3 error: ${status.slice(0, 200)}`);
        }
        if (!multiline) {
          buffer = buffer.subarray(lineEnd + 2);
          return Buffer.from(status, "latin1");
        }
        // An empty body ends with ".\r\n" straight after the status line.
        const rest = buffer.subarray(lineEnd + 2);
        if (rest.subarray(0, 3).toString("latin1") === ".\r\n") {
          buffer = rest.subarray(3);
          return Buffer.alloc(0);
        }
        const end = buffer.indexOf(TERMINATOR, lineEnd);
        if (end >= 0) {
          const body = buffer.subarray(lineEnd + 2, end + 2);
          buffer = buffer.subarray(end + TERMINATOR.length);
          return Buffer.from(
            body.toString("latin1").replace(/^\.\./gm, "."),
            "latin1",
          );
        }
      }
      if (failure) throw failure;
      await new Promise<void>((resolve) => {
        waiter = resolve;
      });
      waiter = null;
    }
  }

  function send(command: string, multiline = false) {
    socket.write(`${command}\r\n`);
    return read(multiline);
  }

  try {
    await read(false);
    await send(`USER ${options.user}`);
    await send(`PASS ${options.password}`);
  } catch (error) {
    socket.destroy();
    throw new Error("POP3 login failed", { cause: error });
  }

  return {
    async list() {
      const body = (await send("UIDL", true)).toString("latin1");
      return body
        .split("\r\n")
        .filter(Boolean)
        .map((line) => {
          const [number = "", uid = ""] = line.split(" ");
          return { number: Number(number), uid };
        });
    },
    /** The message's size in bytes, from LIST. */
    async size(number: number) {
      const status = (await send(`LIST ${number}`)).toString("latin1");
      return Number(status.split(" ")[2]);
    },
    headers: (number: number) => send(`TOP ${number} 0`, true),
    retrieve: (number: number) => send(`RETR ${number}`, true),
    remove: async (number: number) => {
      await send(`DELE ${number}`);
    },
    async quit() {
      try {
        await send("QUIT");
      } finally {
        socket.destroy();
      }
    },
    close: () => socket.destroy(),
  };
}

export type Pop3Mailbox = Awaited<ReturnType<typeof openPop3>>;
