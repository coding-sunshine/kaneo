export type ProjectBroadcastMessage = {
  type: string;
  projectId: string;
  taskId?: string;
  tasks?: Array<{ id: string; position: number; status?: string }>;
  sourceTaskId?: string;
  targetTaskId?: string;
  linksChanged?: boolean;
  taskTitleChanged?: boolean;
};

export type BroadcastMessage = {
  projectId: string;
  message: ProjectBroadcastMessage;
  excludeInitiatorId?: string;
  authorizationBatch?: string;
};

export type UserBroadcastMessage = {
  type: string;
  [key: string]: unknown;
};

export type UserBroadcast = {
  userId: string;
  message: UserBroadcastMessage;
  origin?: string;
};

/**
 * Says that a channel changed, so clients refetch what they may read, or that
 * a member started or stopped typing in it. Typing is never stored.
 */
export type ChatBroadcastMessage = {
  type: string;
  channelId: string;
  userId?: string;
  typing?: boolean;
};

export type ChatBroadcast = {
  channelId: string;
  message: ChatBroadcastMessage;
  origin?: string;
};

export type BroadcastAdapter = {
  /** Publish a message to all instances watching this project */
  publish(msg: BroadcastMessage): Promise<void>;

  publishToUser(msg: UserBroadcast): Promise<void>;

  /** Subscribe to messages for delivery to local connections */
  subscribe(
    handler: (msg: BroadcastMessage) => void | Promise<void>,
  ): Promise<void>;

  subscribeToUser(
    handler: (msg: UserBroadcast) => void | Promise<void>,
    onRecovery?: () => Promise<void>,
  ): Promise<void>;

  publishToChat(msg: ChatBroadcast): Promise<void>;

  subscribeToChat(
    handler: (msg: ChatBroadcast) => void | Promise<void>,
  ): Promise<void>;

  /** Cleanup on shutdown */
  shutdown(): Promise<void>;
};
