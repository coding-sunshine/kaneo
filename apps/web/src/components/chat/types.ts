import type { getChannel, getChannels } from "@/fetchers/chat/channels";
import type { getMessages } from "@/fetchers/chat/messages";

export type ChatChannel = Awaited<ReturnType<typeof getChannels>>[number];
export type ChatChannelDetail = Awaited<ReturnType<typeof getChannel>>;
export type ChatMessage = Awaited<ReturnType<typeof getMessages>>[number];
