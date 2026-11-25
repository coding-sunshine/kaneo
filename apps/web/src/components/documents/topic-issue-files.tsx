import { useTranslation } from "react-i18next";
import { useIssueFiles } from "@/hooks/queries/document/use-issue-files";
import { IssueFileList } from "./issue-file-list";
import { TopicSection } from "./topic-section";

type TopicIssueFilesProps = { workspaceId: string; topicId: string };

/** Files on the topic's issues; nothing at all when there are none. */
export function TopicIssueFiles({
  workspaceId,
  topicId,
}: TopicIssueFilesProps) {
  const { t } = useTranslation();
  const { data: files = [] } = useIssueFiles(workspaceId, topicId);
  if (!files.length) return null;
  return (
    <TopicSection
      id="topic-issue-files"
      title={t("navigation:documents.issueFiles.title")}
    >
      <IssueFileList
        workspaceId={workspaceId}
        files={files}
        topicId={topicId}
      />
    </TopicSection>
  );
}
