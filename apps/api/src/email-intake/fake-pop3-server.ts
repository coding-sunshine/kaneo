import { once } from "node:events";
import { createServer, type Socket } from "node:net";

// A loopback-only POP3 mailbox for tests: it never talks to a real mail server.
// UIDs differ between servers, as they would between real messages.
let servers = 0;

export async function createFakePop3Server({
  user,
  password,
  messages,
}: {
  user: string;
  password: string;
  messages: string[];
}) {
  servers += 1;
  const mailbox = messages.map((raw, index) => ({
    uid: `uid-${servers}-${index + 1}`,
    raw,
    deleted: false,
  }));
  const commands: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let pending = "";
    let authenticated = false;
    let givenUser = "";
    const marked = new Set<number>();
    const reply = (line: string) => socket.write(`${line}\r\n`);
    const multi = (head: string, body: string[]) => {
      const lines = body.map((line) =>
        line.startsWith(".") ? `.${line}` : line,
      );
      socket.write(`${head}\r\n${[...lines, "."].join("\r\n")}\r\n`);
    };
    const live = () =>
      mailbox
        .map((message, index) => ({ ...message, number: index + 1 }))
        .filter((message) => !message.deleted);
    const find = (argument: string | undefined) =>
      live().find((message) => message.number === Number(argument));

    reply("+OK fake POP3 ready");
    socket.on("data", (chunk) => {
      pending += chunk.toString("latin1");
      let end = pending.indexOf("\r\n");
      while (end >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        end = pending.indexOf("\r\n");
        const [verb = "", ...args] = line.split(" ");
        const command = verb.toUpperCase();
        commands.push(command === "PASS" ? "PASS ***" : line);
        if (command === "USER") {
          givenUser = args.join(" ");
          reply("+OK");
        } else if (command === "PASS") {
          authenticated = givenUser === user && args.join(" ") === password;
          reply(authenticated ? "+OK logged in" : "-ERR invalid login");
        } else if (command === "QUIT") {
          for (const number of marked) {
            const message = mailbox[number - 1];
            if (message) message.deleted = true;
          }
          socket.end("+OK bye\r\n");
        } else if (!authenticated) {
          reply("-ERR log in first");
        } else if (command === "UIDL") {
          multi(
            "+OK",
            live().map((message) => `${message.number} ${message.uid}`),
          );
        } else if (command === "LIST" && args[0]) {
          const message = find(args[0]);
          reply(
            message
              ? `+OK ${message.number} ${Buffer.byteLength(message.raw)}`
              : "-ERR no such message",
          );
        } else if (command === "TOP" || command === "RETR") {
          const message = find(args[0]);
          if (!message) {
            reply("-ERR no such message");
            continue;
          }
          const lines = message.raw.split("\r\n");
          const blank = lines.indexOf("");
          multi(
            "+OK",
            command === "TOP" && blank >= 0 ? lines.slice(0, blank) : lines,
          );
        } else if (command === "DELE") {
          const message = find(args[0]);
          if (message) marked.add(message.number);
          reply(message ? "+OK marked" : "-ERR no such message");
        } else {
          reply("-ERR unknown command");
        }
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No POP3 port");
  return {
    port: address.port,
    commands,
    remaining: () =>
      mailbox.filter((message) => !message.deleted).map(({ raw }) => raw),
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
