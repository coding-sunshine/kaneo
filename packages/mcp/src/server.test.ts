import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vite-plus/test";
import { createMcpServer } from "./server.js";

describe("createMcpServer", () => {
  it("sends instructions that ask for get_current first in the initialize response", async () => {
    const server = createMcpServer();
    const client = new Client({ name: "instructions-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const instructions = client.getInstructions() ?? "";
    expect(instructions.slice(0, 512)).toMatch(
      /call get_current before you draft or save/i,
    );
    await client.close();
  });
});
