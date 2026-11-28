import { AtSign, FileText, SquareCheck, User, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type MentionPick,
  mentionToken,
} from "@/components/chat/mention-token";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";

type Result = {
  type: string;
  id: string;
  title: string;
  userId?: string;
  projectSlug?: string;
  taskNumber?: number;
};

const ICONS = {
  person: User,
  task: SquareCheck,
  document: FileText,
  project: Users,
};

function toPick(result: Result): MentionPick | null {
  if (result.type === "person" && result.userId)
    return { type: "person", userId: result.userId };
  if (
    result.type === "task" &&
    result.projectSlug &&
    result.taskNumber !== undefined
  )
    return {
      type: "task",
      projectSlug: result.projectSlug,
      taskNumber: result.taskNumber,
    };
  if (result.type === "document") return { type: "document", id: result.id };
  if (result.type === "project") return { type: "project", id: result.id };
  return null;
}

/**
 * Search people, tickets, documents and teams; picking one hands its token to
 * `onPick`, which the composer adds to the message.
 */
export function MentionPicker({
  workspaceId,
  onPick,
}: {
  workspaceId: string;
  onPick: (token: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim();
  const people = useGlobalSearch({ q, type: "people", workspaceId, limit: 5 });
  const things = useGlobalSearch({ q, type: "all", workspaceId, limit: 10 });
  // Both searches can return the same person, so each shows once.
  const seen = new Set<string>();
  const results = [
    ...(people.data?.results ?? []),
    ...(things.data?.results ?? []),
  ].flatMap((result) => {
    const pick = toPick(result);
    const key = `${result.type}:${result.id}`;
    if (!pick || seen.has(key)) return [];
    seen.add(key);
    return [{ result, pick, key }];
  });

  const choose = (pick: MentionPick) => {
    onPick(mentionToken(pick, workspaceId, window.location.origin));
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title={t("navigation:chat.mention")}
        aria-label={t("navigation:chat.mention")}
        onClick={() => setOpen(true)}
      >
        <AtSign />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("navigation:chat.mention")}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Input
              size="sm"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("navigation:chat.mentionSearch")}
              aria-label={t("navigation:chat.mentionSearch")}
            />
            <ul className="mt-1 flex flex-col">
              {results.map(({ result, pick, key }) => {
                const Icon = ICONS[pick.type];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => choose(pick)}
                    >
                      <Icon
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      {pick.type === "task" && (
                        <span className="shrink-0 font-mono text-muted-foreground text-xs">
                          {mentionToken(pick, workspaceId, "")}
                        </span>
                      )}
                      <span className="truncate">{result.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {q !== "" &&
              !people.isFetching &&
              !things.isFetching &&
              results.length === 0 && (
                <p className="px-2 py-1.5 text-muted-foreground text-sm">
                  {t("navigation:chat.noMentionMatches")}
                </p>
              )}
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
