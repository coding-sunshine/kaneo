import { useTranslation } from "react-i18next";

/** What a topic's current document is, in words, for a row or a suggestion. */
export function useTopicCurrentLine(topic: {
  currentDocumentId: string | null;
  currentDocumentTitle: string | null;
}) {
  const { t } = useTranslation();
  if (topic.currentDocumentTitle)
    return t("navigation:documents.taskTopic.current", {
      title: topic.currentDocumentTitle,
    });
  return topic.currentDocumentId
    ? t("navigation:documents.taskTopic.cannotOpen")
    : t("navigation:documents.taskTopic.nothingCurrent");
}
