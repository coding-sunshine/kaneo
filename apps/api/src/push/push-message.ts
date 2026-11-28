/** What a tapped push opens. Kept small: it travels through Apple or Google. */
export type PushData = {
  kind: "chat";
  workspaceId: string;
  chatChannelId: string;
};

export type PushMessage = {
  title: string;
  body: string;
  /** Groups a channel's pushes together on the lock screen. */
  threadId: string;
  data: PushData;
};

/** "dead" means the provider says the token will never work again. */
export type PushResult = "sent" | "dead" | "failed";

export type PushSender = (
  token: string,
  message: PushMessage,
) => Promise<PushResult>;
