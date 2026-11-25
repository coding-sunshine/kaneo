import { Link } from "@tanstack/react-router";
import { Paperclip } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IssueFile } from "@/fetchers/document/issue-files";
import { ProposeIssueFileDialog } from "./propose-issue-file-dialog";

type IssueFileListProps = {
  workspaceId: string;
  files: IssueFile[];
  /** Show only this topic's action on each row. */
  topicId?: string;
};

type Proposing = { file: IssueFile; topic: IssueFile["topics"][number] };

/** One row per issue file: the file, its issue, and what to do per topic. */
export function IssueFileList({
  workspaceId,
  files,
  topicId,
}: IssueFileListProps) {
  const { t } = useTranslation();
  const [proposing, setProposing] = useState<Proposing | null>(null);
  return (
    <>
      <ul className="flex flex-col">
        {files.map((file) => {
          const topics = topicId
            ? file.topics.filter((topic) => topic.id === topicId)
            : file.topics;
          return (
            <li
              key={file.id}
              className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-border/60 border-b px-4 py-2 text-[13px]"
            >
              <Paperclip
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                title={file.filename}
                className="min-w-0 max-w-full truncate font-medium outline-none hover:underline focus-visible:underline"
              >
                {file.filename}
              </a>
              <Badge variant="outline" size="sm" className="shrink-0">
                {t("navigation:documents.issueFiles.badge")}
              </Badge>
              <Link
                to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                params={{
                  workspaceId,
                  projectId: file.task.projectId,
                  taskId: file.task.id,
                }}
                className="flex min-w-0 max-w-full items-center gap-2 outline-none hover:underline focus-visible:underline"
              >
                <span className="shrink-0 font-medium">
                  {`${file.task.projectSlug.toUpperCase()}-${file.task.number}`}
                </span>
                <span className="min-w-0 truncate">{file.task.title}</span>
              </Link>
              {topics.length === 0 ? (
                <span className="text-muted-foreground">
                  {t("navigation:documents.issueFiles.noTopic")}
                </span>
              ) : (
                topics.map((topic) => (
                  <span
                    key={topic.id}
                    className="flex min-w-0 max-w-full items-center gap-2"
                  >
                    {!topicId && (
                      <Link
                        to="/dashboard/workspace/$workspaceId/topic/$topicId"
                        params={{ workspaceId, topicId: topic.id }}
                        className="min-w-0 truncate text-muted-foreground outline-none hover:underline focus-visible:underline"
                      >
                        {topic.name}
                      </Link>
                    )}
                    {topic.proposedDocumentId ? (
                      <Link
                        to="/dashboard/workspace/$workspaceId/document/$documentId"
                        params={{
                          workspaceId,
                          documentId: topic.proposedDocumentId,
                        }}
                        className="shrink-0 underline underline-offset-2"
                      >
                        {t("navigation:documents.issueFiles.proposed")}
                      </Link>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        className="shrink-0"
                        onClick={() => setProposing({ file, topic })}
                      >
                        {t("navigation:documents.issueFiles.propose")}
                      </Button>
                    )}
                  </span>
                ))
              )}
            </li>
          );
        })}
      </ul>
      {proposing && (
        <ProposeIssueFileDialog
          workspaceId={workspaceId}
          file={proposing.file}
          topic={proposing.topic}
          open
          onOpenChange={(open) => !open && setProposing(null)}
        />
      )}
    </>
  );
}
