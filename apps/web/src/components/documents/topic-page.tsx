import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDocument,
  useDocuments,
} from "@/hooks/queries/document/use-documents";
import { useTopic } from "@/hooks/queries/topic/use-topics";
import { getInitials } from "@/lib/get-initials";
import { DocumentList } from "./document-list";
import { DocumentReplaceIntent } from "./document-replace-intent";
import { TopicCurrentDocument } from "./topic-current-document";
import { RecordDecisionButton } from "./record-decision-button";
import { TopicFollowButton } from "./topic-follow-button";
import { TopicIssueFiles } from "./topic-issue-files";
import { TopicIssueFacts } from "./topic-issue-facts";
import { TopicIssues } from "./topic-issues";
import { TopicFacts } from "./topic-facts";
import { TopicSection } from "./topic-section";

type TopicPageProps = { workspaceId: string; topicId: string };

/**
 * One question the team decides: the document that holds today, then the
 * proposals waiting for its decider, then what was replaced. Deciding happens
 * on the document itself, where its text is in view.
 */
export function TopicPage({ workspaceId, topicId }: TopicPageProps) {
  const { t } = useTranslation();
  const { data: topic, isLoading } = useTopic(workspaceId, topicId);
  const { data: documents = [] } = useDocuments(
    workspaceId,
    { topicId },
    Boolean(topic),
  );
  const { data: current } = useDocument(
    workspaceId,
    topic?.currentDocumentId ?? "",
  );

  if (!topic) {
    return (
      <WorkspaceLayout title={t("navigation:documents.topics.title")}>
        {isLoading ? (
          <div className="mx-auto flex w-full max-w-[55rem] flex-col gap-3 px-10 pt-12">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-6 h-24 w-full" />
          </div>
        ) : (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
            <h1 className="font-medium text-sm">
              {t("navigation:documents.topics.notFound")}
            </h1>
            <p className="max-w-72 text-muted-foreground text-xs">
              {t("navigation:documents.topics.notFoundHint")}
            </p>
            <Link
              to="/dashboard/workspace/$workspaceId/documents"
              params={{ workspaceId }}
              className="mt-2 text-xs underline underline-offset-2"
            >
              {t("navigation:documents.title")}
            </Link>
          </div>
        )}
      </WorkspaceLayout>
    );
  }

  const proposals = documents.filter((row) => row.status === "in_review");
  const replaced = documents.filter((row) => row.status === "superseded");

  return (
    <>
      <PageTitle title={topic.name} />
      <WorkspaceLayout title={topic.name}>
        <div className="mx-auto flex w-full max-w-[55rem] flex-col gap-8 py-10">
          <header className="flex flex-col gap-3 px-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <h1 className="min-w-48 flex-1 break-words font-semibold text-2xl leading-8">
                {topic.name}
              </h1>
              <div className="flex shrink-0 items-center gap-2">
                <RecordDecisionButton topic={topic} />
                <TopicFollowButton topic={topic} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-xs">
              <span>
                {topic.parentName ?? t("navigation:documents.scopes.workspace")}
              </span>
              {topic.deciderId ? (
                <span className="flex items-center gap-1.5">
                  <Avatar className="size-5">
                    <AvatarImage src={topic.deciderImage ?? ""} alt="" />
                    <AvatarFallback className="bg-muted font-semibold text-[9px]">
                      {getInitials(topic.deciderName ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  {t("navigation:documents.topics.decider", {
                    name: topic.deciderName ?? "",
                  })}
                </span>
              ) : (
                <span>{t("navigation:documents.topics.noDecider")}</span>
              )}
              {topic.backupDeciderId && (
                <span>
                  {t("navigation:documents.topics.backup", {
                    name: topic.backupDeciderName ?? "",
                  })}
                </span>
              )}
            </div>
          </header>
          <TopicFacts
            workspaceId={workspaceId}
            topicId={topicId}
            canManage={topic.canDecide}
          />
          <TopicSection
            id="topic-current"
            title={t("navigation:documents.topics.current")}
          >
            {current?.status === "current" ? (
              <TopicCurrentDocument document={current} />
            ) : (
              !topic.currentDocumentId && (
                <p className="px-4 text-muted-foreground text-sm">
                  {t("navigation:documents.topics.noCurrent")}
                </p>
              )
            )}
          </TopicSection>
          <TopicSection
            id="topic-proposals"
            title={t("navigation:documents.topics.proposals")}
          >
            {proposals.length ? (
              <DocumentList
                workspaceId={workspaceId}
                documents={proposals}
                action={(row) =>
                  row.replacesDocumentId && (
                    <DocumentReplaceIntent
                      workspaceId={workspaceId}
                      targetId={row.replacesDocumentId}
                      title={
                        documents.find(
                          (other) => other.id === row.replacesDocumentId,
                        )?.title ?? null
                      }
                      stale={row.replacesDocumentId !== topic.currentDocumentId}
                    />
                  )
                }
              />
            ) : (
              <p className="px-4 text-muted-foreground text-sm">
                {t("navigation:documents.topics.noProposals")}
              </p>
            )}
          </TopicSection>
          <TopicIssues workspaceId={workspaceId} topicId={topicId} />
          <TopicIssueFacts workspaceId={workspaceId} topicId={topicId} />
          <TopicIssueFiles workspaceId={workspaceId} topicId={topicId} />
          {replaced.length > 0 && (
            <TopicSection
              id="topic-replaced"
              title={t("navigation:documents.topics.replaced")}
            >
              <DocumentList workspaceId={workspaceId} documents={replaced} />
            </TopicSection>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
