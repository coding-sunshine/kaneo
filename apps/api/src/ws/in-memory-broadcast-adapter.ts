import type {
  BroadcastAdapter,
  BroadcastMessage,
  ChatBroadcast,
  UserBroadcast,
} from "./broadcast-adapter";

export class InMemoryBroadcastAdapter implements BroadcastAdapter {
  private handler?: (msg: BroadcastMessage) => void | Promise<void>;
  private userHandler?: (msg: UserBroadcast) => void | Promise<void>;
  private chatHandler?: (msg: ChatBroadcast) => void | Promise<void>;

  async publish(msg: BroadcastMessage): Promise<void> {
    // Deliver directly in the same process
    await this.handler?.(msg);
  }

  async publishToUser(msg: UserBroadcast): Promise<void> {
    await this.userHandler?.(msg);
  }

  async publishToChat(msg: ChatBroadcast): Promise<void> {
    await this.chatHandler?.(msg);
  }

  async subscribe(
    handler: (msg: BroadcastMessage) => void | Promise<void>,
  ): Promise<void> {
    this.handler = handler;
  }

  async subscribeToUser(
    handler: (msg: UserBroadcast) => void | Promise<void>,
  ): Promise<void> {
    this.userHandler = handler;
  }

  async subscribeToChat(
    handler: (msg: ChatBroadcast) => void | Promise<void>,
  ): Promise<void> {
    this.chatHandler = handler;
  }

  async shutdown(): Promise<void> {
    this.handler = undefined;
    this.userHandler = undefined;
    this.chatHandler = undefined;
  }
}
