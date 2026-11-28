import { subscribeToEvent } from "../../events";
import { notifyChatMessage } from "./notify-message";

subscribeToEvent<Parameters<typeof notifyChatMessage>[0]>(
  "chat.message_created",
  notifyChatMessage,
);
