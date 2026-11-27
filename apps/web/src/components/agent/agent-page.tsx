import { useNavigate } from "@tanstack/react-router";
import { Box, Search, Workflow, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentComposer } from "@/components/agent/agent-composer";
import { AgentTranscript } from "@/components/agent/agent-transcript";
import { Spinner } from "@/components/ui/spinner";
import { useSendMessage } from "@/hooks/mutations/agent/use-agent-mutations";
import { useAgentChat } from "@/hooks/queries/agent/use-agent";
import { toast } from "@/lib/toast";

const EXAMPLES = [
  { key: "project", icon: Box },
  { key: "research", icon: Search },
  { key: "loop", icon: Workflow },
] as const;

type AgentPageProps = { workspaceId: string; chatId?: string };

/** Linear's Agent page: new chat with starter examples, or an open transcript. */
export function AgentPage({ workspaceId, chatId }: AgentPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: chat } = useAgentChat(workspaceId, chatId);
  const send = useSendMessage(workspaceId);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(true);

  const submit = (message: string) => {
    setPendingText(message);
    send.mutate(
      { chatId, message },
      {
        onSuccess: (reply) =>
          reply.chatId &&
          navigate({
            to: "/dashboard/workspace/$workspaceId/agent",
            params: { workspaceId },
            search: { chat: reply.chatId },
          }),
        onError: (error) => toast.error(error.message),
        onSettled: () => setPendingText(null),
      },
    );
  };

  const messages = chat?.messages ?? [];
  const isNew = !chatId && pendingText === null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        {isNew ? (
          <div className="mx-auto flex h-full max-w-[712px] flex-col justify-end gap-3 px-4 pb-[18vh]">
            <AgentComposer
              placeholder={t("navigation:agent.placeholder")}
              pending={send.isPending}
              onSubmit={submit}
            />
            {showExamples ? (
              <>
                <div className="flex items-center justify-between px-3 text-muted-foreground text-xs">
                  <span>{t("navigation:agent.examplesTitle")}</span>
                  <button
                    type="button"
                    aria-label={t("common:actions.close")}
                    onClick={() => setShowExamples(false)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {EXAMPLES.map(({ key, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      className="flex h-[134px] flex-col gap-1 rounded-lg border border-border/70 bg-card p-3.5 text-left hover:bg-accent/50"
                      onClick={() =>
                        submit(t(`navigation:agent.examples.${key}.prompt`))
                      }
                    >
                      <Icon className="mb-auto size-3.5 text-muted-foreground" />
                      <span className="text-[13px]">
                        {t(`navigation:agent.examples.${key}.title`)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {t(`navigation:agent.examples.${key}.description`)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto max-w-[712px] px-4 py-6">
            <AgentTranscript
              workspaceId={workspaceId}
              chatId={chatId}
              proposals={chat?.proposals}
              messages={[
                ...messages,
                ...(pendingText
                  ? [{ role: "user" as const, content: pendingText }]
                  : []),
                ...send.live.messages,
                ...(send.live.text
                  ? [{ role: "assistant" as const, content: send.live.text }]
                  : []),
              ]}
            />
            {send.isPending ? (
              <p className="mt-3 flex items-center gap-2 text-muted-foreground text-xs">
                <Spinner className="size-3" />
                {t("navigation:agent.thinking")}
              </p>
            ) : null}
          </div>
        )}
      </div>
      {isNew ? null : (
        <div className="mx-auto w-full max-w-[712px] px-4 pb-6">
          <AgentComposer
            placeholder={t("navigation:agent.followUp")}
            pending={send.isPending}
            onSubmit={submit}
          />
        </div>
      )}
    </div>
  );
}
