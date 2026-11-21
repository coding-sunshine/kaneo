import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  type DocumentDetail,
  updateDocument,
} from "@/fetchers/document/documents";
import {
  documentKey,
  documentsKey,
} from "@/hooks/queries/document/use-documents";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import {
  DOCUMENT_SAVE_OWNER,
  documentSaveKey,
  latestDocumentValue,
} from "./document-save";

type DocumentEditorProps = {
  document: DocumentDetail;
  readOnly: boolean;
  titleRef?: React.Ref<HTMLTextAreaElement>;
};

const bodyClass =
  "[&_.kaneo-comment-editor-content_.ProseMirror]:min-h-[50vh] [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-none [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-visible [&_.kaneo-comment-editor-content_.ProseMirror]:px-0 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-1 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-24 [&_.kaneo-comment-editor-content_.ProseMirror]:text-[15px] [&_.kaneo-comment-editor-content_.ProseMirror]:leading-6";

/**
 * Title and body of a document, saved as you type. Both are seeded once from
 * the document; the parent re-keys this component to load other content.
 */
export function DocumentEditor({
  document,
  readOnly,
  titleRef,
}: DocumentEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { workspaceId, id } = document;
  const titleKey = documentSaveKey("title", id);
  const contentKey = documentSaveKey("content", id);
  const [initial] = useState(() => ({
    title: latestDocumentValue(titleKey, document.title),
    content: latestDocumentValue(contentKey, document.content),
  }));
  const [title, setTitle] = useState(initial.title);
  const last = useRef(initial);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ownerId = DOCUMENT_SAVE_OWNER;
  const failed = useSyncExternalStore(descriptionSaveQueue.subscribe, () =>
    [titleKey, contentKey].find(
      (key) => descriptionSaveQueue.get(key, ownerId)?.state === "failed",
    ),
  );

  const schedule = (field: "title" | "content", value: string) => {
    if (readOnly || last.current[field] === value) return;
    last.current[field] = value;
    descriptionSaveQueue.schedule(
      field === "title" ? titleKey : contentKey,
      value,
      async (saved) => {
        const fresh = await updateDocument(workspaceId, id, {
          [field]: saved,
        });
        queryClient.setQueryData(documentKey(workspaceId, id), fresh);
        queryClient.invalidateQueries({
          queryKey: [...documentsKey(workspaceId), "list"],
        });
      },
      ownerId,
    );
  };

  const editorName = document.updatedByName ?? document.creatorName;
  const editorImage =
    !document.updatedById || document.updatedById === document.creatorId
      ? document.creatorImage
      : null;

  return (
    <div className="mx-auto w-full max-w-[55rem] px-6 pt-28 sm:px-10">
      <textarea
        ref={titleRef}
        rows={1}
        value={title}
        readOnly={readOnly}
        aria-label={t("navigation:documents.titlePlaceholder")}
        placeholder={t("navigation:documents.untitled")}
        onChange={(event) => {
          setTitle(event.target.value);
          schedule("title", event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          bodyRef.current
            ?.querySelector<HTMLElement>("[contenteditable=true]")
            ?.focus();
        }}
        className="field-sizing-content w-full resize-none bg-transparent font-semibold text-2xl leading-8 outline-none placeholder:text-muted-foreground/60"
      />
      <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground text-xs">
        <Avatar className="size-4">
          <AvatarImage src={editorImage ?? ""} alt="" />
          <AvatarFallback className="bg-muted font-semibold text-[8px]">
            {getInitials(editorName)}
          </AvatarFallback>
        </Avatar>
        <span>
          {t("navigation:documents.updated", {
            time: formatRelativeTime(document.updatedAt),
          })}
        </span>
        {readOnly && (
          <span className="ml-1 rounded border border-border px-1 text-[11px]">
            {t("navigation:documents.viewOnly")}
          </span>
        )}
        {failed && (
          <span role="alert" className="ml-1 text-destructive">
            {t("navigation:documents.saveFailed")}{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => descriptionSaveQueue.retry(failed, ownerId)}
            >
              {t("navigation:documents.retry")}
            </button>
          </span>
        )}
      </div>
      <div ref={bodyRef} className="kaneo-document-body mt-8">
        <CommentEditor
          value={initial.content}
          onChange={
            readOnly ? undefined : (value) => schedule("content", value)
          }
          readOnly={readOnly}
          showBubbleMenu={!readOnly}
          placeholder={t("navigation:documents.bodyPlaceholder")}
          slashMenuPosition="fixed"
          className={bodyClass}
        />
      </div>
    </div>
  );
}
