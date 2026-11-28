import { subscribeToEvent } from "../../events";
import { type AssistantAsk, answerMention } from "./answer-mention";

// Runs after the post returns, so the model never delays the message.
subscribeToEvent<AssistantAsk>("chat.assistant_mentioned", answerMention);
