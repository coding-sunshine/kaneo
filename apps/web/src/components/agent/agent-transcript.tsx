import { ChevronRight, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentCitation } from "@/components/agent/agent-citation";
import { AgentSources } from "@/components/agent/agent-sources";
import { withoutSourcesLine } from "@/components/agent/without-sources-line";
import { cn } from "@/lib/cn";

export type TranscriptMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  /** On a saved chat answer: what it rests on, checked for the reader. */
  citations?: AgentCitation[];
  unsourced?: boolean;
};

function ToolCall({
  name,
  args,
  result,
}: {
  name: string;
  args: string;
  result?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <details className="group/tool rounded-lg border border-border/70 bg-muted/30 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-muted-foreground">
        <ChevronRight className="size-3 transition-transform group-open/tool:rotate-90" />
        <Wrench className="size-3" aria-hidden="true" />
        <span className="font-mono">{name}</span>
      </summary>
      <div className="flex flex-col gap-2 border-border/70 border-t px-2.5 py-2">
        <div>
          <p className="mb-0.5 font-medium text-muted-foreground">
            {t("navigation:agent.toolInput")}
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono">
            {args}
          </pre>
        </div>
        <div>
          <p className="mb-0.5 font-medium text-muted-foreground">
            {t("navigation:agent.toolResult")}
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono">
            {result ?? t("navigation:agent.toolPending")}
          </pre>
        </div>
      </div>
    </details>
  );
}

/**
 * One chat or loop run: messages in order, every tool call shown with its
 * result. A chat's answers end with their sources, which link into
 * `workspaceId`.
 */
export function AgentTranscript({
  messages,
  workspaceId,
}: {
  messages: TranscriptMessage[];
  workspaceId?: string;
}) {
  const results = new Map(
    messages
      .filter((message) => message.role === "tool" && message.tool_call_id)
      .map((message) => [message.tool_call_id, message.content]),
  );

  return (
    <ol className="flex flex-col gap-3 text-[13px]">
      {messages.map((message, index) => {
        if (message.role === "system" || message.role === "tool") return null;
        const key = `${index}-${message.role}`;
        // A reply still arriving has not had its sources line taken off.
        const content =
          message.role === "assistant" && message.content && !message.citations
            ? withoutSourcesLine(message.content)
            : message.content;
        return (
          <li
            key={key}
            className={cn(
              "flex flex-col gap-1.5",
              message.role === "user" && "items-end",
            )}
          >
            {content ? (
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words",
                  message.role === "user" && "rounded-2xl bg-muted px-3 py-2",
                )}
              >
                {content}
              </p>
            ) : null}
            {workspaceId && message.citations ? (
              <AgentSources
                workspaceId={workspaceId}
                citations={message.citations}
                unsourced={message.unsourced ?? false}
              />
            ) : null}
            {message.tool_calls?.map((call) => (
              <ToolCall
                key={call.id}
                name={call.function.name}
                args={call.function.arguments}
                result={results.get(call.id)}
              />
            ))}
          </li>
        );
      })}
    </ol>
  );
}
