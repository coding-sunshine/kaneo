import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatFileButton } from "@/components/chat/chat-file-button";
import { CommandNotice } from "@/components/chat/command-notice";
import { MentionPicker } from "@/components/chat/mention-picker";
import { SkillResultCard } from "@/components/chat/skills/skill-result-card";
import { SkillsDialog } from "@/components/chat/skills/skills-dialog";
import { useSkillCommand } from "@/components/chat/skills/use-skill-command";
import { readSlashCommand } from "@/components/chat/slash-command";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePostMessage } from "@/hooks/mutations/chat/use-post-message";
import { useRunChatCommand } from "@/hooks/mutations/chat/use-run-chat-command";
import { useSendChatFile } from "@/hooks/mutations/chat/use-send-chat-file";
import { useChannelDraft } from "@/hooks/use-channel-draft";
import { useTypingSignal } from "@/hooks/use-typing-signal";
import { toast } from "@/lib/toast";

type MessageComposerProps = {
  workspaceId: string;
  channelId: string;
  channelName: string;
  onPosted?: () => void;
};

export function MessageComposer({
  workspaceId,
  channelId,
  channelName,
  onPosted,
}: MessageComposerProps) {
  const { t } = useTranslation();
  const { body, setBody, beforeSend, clear } = useChannelDraft(
    workspaceId,
    channelId,
  );
  const post = usePostMessage(workspaceId, channelId);
  const sendFile = useSendChatFile(workspaceId, channelId);
  const typing = useTypingSignal(workspaceId, channelId);
  const command = useRunChatCommand(workspaceId, channelId);
  const skill = useSkillCommand(workspaceId, channelId);
  const [notice, setNotice] = useState<string | null>(null);
  const busy =
    post.isPending ||
    sendFile.isPending ||
    command.isPending ||
    skill.isRunning;
  // Set before the first await: isPending only turns true on a later render,
  // so without it every key press in between would post the message again.
  const sending = useRef(false);

  const send = async () => {
    const text = body.trim();
    if (!text || busy || sending.current) return;
    // Built-in commands win; any other `/name` runs one of my skills, for me
    // alone and never posted; a name that is neither says so.
    const slash = readSlashCommand(text);
    if (!(slash && "name" in slash) && skill.tryRun(text)) {
      typing.stop();
      setNotice(null);
      clear();
      return;
    }
    if (slash && "unknown" in slash)
      return setNotice(
        t("navigation:chat.commands.unknown", { name: slash.unknown }),
      );
    sending.current = true;
    typing.stop();
    setNotice(null);
    try {
      await beforeSend();
    } catch {
      sending.current = false;
      return;
    }
    if (slash) {
      command.mutate(text, {
        onSuccess: (result) => {
          clear();
          if (result.command === "remind")
            setNotice(
              t("navigation:chat.commands.reminderSet", {
                time: new Date(result.remindAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              }),
            );
          if (result.command === "status")
            setNotice(
              result.status
                ? t("navigation:chat.commands.statusSet", {
                    status: result.status,
                  })
                : t("navigation:chat.commands.statusCleared"),
            );
          if (result.command === "ticket") onPosted?.();
        },
        onError: (error) => setNotice(error.message),
        onSettled: () => {
          sending.current = false;
        },
      });
      return;
    }
    post.mutate(text, {
      onSuccess: () => {
        clear();
        onPosted?.();
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => {
        sending.current = false;
      },
    });
  };

  // The typed text goes with the files, as their one message.
  const attach = async (files: File[]) => {
    typing.stop();
    await beforeSend();
    sendFile.mutate(
      { files, body: body.trim() || undefined },
      {
        onSuccess: () => {
          clear();
          onPosted?.();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      {skill.result && (
        <SkillResultCard
          workspaceId={workspaceId}
          result={skill.result}
          onDismiss={skill.dismiss}
        />
      )}
      {notice && (
        <CommandNotice message={notice} onDismiss={() => setNotice(null)} />
      )}
      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Textarea
          value={body}
          maxLength={4000}
          rows={2}
          aria-label={t("navigation:chat.messageLabel")}
          placeholder={t("navigation:chat.messagePlaceholder", {
            name: channelName,
          })}
          onChange={(event) => {
            setBody(event.target.value);
            // A command is for me alone, so nobody sees me "typing" it.
            if (event.target.value.trimStart().startsWith("/")) typing.stop();
            else typing.typed(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              // A held key repeats; only the first press sends.
              if (!event.repeat) void send();
            }
          }}
        />
        <MentionPicker
          workspaceId={workspaceId}
          onPick={(token) =>
            setBody(`${body}${body && !/\s$/.test(body) ? " " : ""}${token} `)
          }
        />
        <SkillsDialog workspaceId={workspaceId} />
        <ChatFileButton disabled={busy} onPick={attach} />
        <Button type="submit" size="sm" disabled={!body.trim() || busy}>
          {t("navigation:chat.send")}
        </Button>
      </form>
    </>
  );
}
