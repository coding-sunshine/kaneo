// A word of its own, as with @channel, so an address such as
// ops@assistant.example calls on nobody.
const ASSISTANT = /(?<![\p{L}\p{N}_.@-])@assistant(?![\p{L}\p{N}_@-])/iu;

/** Whether a chat message calls on the assistant. */
export const mentionsAssistant = (body: string) => ASSISTANT.test(body);
