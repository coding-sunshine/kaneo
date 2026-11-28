import { useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  type DocumentDetail,
  getDocument,
  updateDocument,
} from "@/fetchers/document/documents";
import { saveCoeditedText } from "@/fetchers/document/collab";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import {
  documentKey,
  documentsKey,
} from "@/hooks/queries/document/use-documents";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { HttpError } from "@/lib/http-error";
import { uploadDocumentFile } from "@/lib/upload-document-file";
import { ChecklistIssuesButton } from "./checklist-issues-button";
import { DocumentCollabBody } from "./collab/document-collab-body";
import type { ChecklistLine } from "./checklist-issues";
import { ChecklistToIssuesDialog } from "./checklist-to-issues-dialog";
import { DocumentConflictBanner } from "./document-conflict-banner";
import { DocumentConflictDialog } from "./document-conflict-dialog";
import { DocumentEditingIndicator } from "./document-editing-indicator";
import { DocumentKindMenu } from "./document-kind-menu";
import {
  DOCUMENT_SAVE_OWNER,
  documentBases,
  documentSaveKey,
  latestDocumentValue,
} from "./document-save";
import { useEditingAnnouncer } from "./use-editing-announcer";
import { useScrollToIssueLine } from "./use-scroll-to-issue-line";

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
  const [initial] = useState(() => {
    documentBases.adopt(id, document.contentHash);
    return {
      title: latestDocumentValue(titleKey, document.title),
      content: latestDocumentValue(contentKey, document.content),
    };
  });
  const [title, setTitle] = useState(initial.title);
  // What the body editor shows; it changes only when the person takes
  // someone else's text.
  const [seed, setSeed] = useState(initial.content);
  // The newer text someone else saved, while this person decides.
  const [conflict, setConflict] = useState<DocumentDetail | null>(null);
  const conflictRef = useRef(conflict);
  const [reviewing, setReviewing] = useState(false);
  const announce = useEditingAnnouncer(workspaceId, id);
  const { data: config } = useGetConfig();
  const { user } = useAuth();
  // Several people type in the body at once; the title still saves alone.
  const coediting = config?.documentCoediting === true && !readOnly;
  // A new co-editing session, after taking someone else's text.
  const [generation, setGeneration] = useState(0);
  // The next co-edited save goes over a text this person has reviewed.
  const reviewed = useRef(false);
  const last = useRef(initial);
  const bodyRef = useRef<HTMLDivElement>(null);
  useScrollToIssueLine(bodyRef);
  const [checklist, setChecklist] = useState<{
    editor: Editor;
    lines: ChecklistLine[];
  } | null>(null);
  const ownerId = DOCUMENT_SAVE_OWNER;
  const failed = useSyncExternalStore(descriptionSaveQueue.subscribe, () =>
    [titleKey, contentKey].find(
      (key) => descriptionSaveQueue.get(key, ownerId)?.state === "failed",
    ),
  );

  const showConflict = (latest: DocumentDetail | null) => {
    conflictRef.current = latest;
    setConflict(latest);
    if (!latest) setReviewing(false);
  };

  const saved = (fresh: DocumentDetail) => {
    queryClient.setQueryData(documentKey(workspaceId, id), fresh);
    queryClient.invalidateQueries({
      queryKey: [...documentsKey(workspaceId), "list"],
    });
  };

  // The body saves on top of the text it started from, so a newer save by
  // someone else stops it until this person has seen that text.
  const saveContent = async (content: string) => {
    if (conflictRef.current) throw new Error("Waiting for review");
    try {
      const fresh = coediting
        ? await saveCoeditedText(workspaceId, id, {
            content,
            ...(reviewed.current && { baseHash: documentBases.get(id) }),
          })
        : await updateDocument(workspaceId, id, {
            content,
            baseHash: documentBases.get(id),
          });
      reviewed.current = false;
      documentBases.set(id, fresh.contentHash);
      saved(fresh);
    } catch (error) {
      if (error instanceof HttpError && error.code === "DOCUMENT_CHANGED") {
        const latest = await getDocument(workspaceId, id);
        queryClient.setQueryData(documentKey(workspaceId, id), latest);
        showConflict(latest);
      }
      throw error;
    }
  };

  const schedule = (
    field: "title" | "content",
    value: string,
    change = { remote: false },
  ) => {
    if (readOnly || last.current[field] === value) return;
    last.current[field] = value;
    // A co-editor's change also arrives here; only typing is announced.
    if (!change.remote) announce();
    descriptionSaveQueue.schedule(
      field === "title" ? titleKey : contentKey,
      value,
      field === "title"
        ? async (title) =>
            saved(await updateDocument(workspaceId, id, { title }))
        : saveContent,
      ownerId,
    );
  };

  const keepMine = () => {
    if (!conflict) return;
    documentBases.set(id, conflict.contentHash);
    reviewed.current = true;
    showConflict(null);
    descriptionSaveQueue.retry(contentKey, ownerId);
  };

  const takeTheirs = () => {
    if (!conflict) return;
    documentBases.set(id, conflict.contentHash);
    descriptionSaveQueue.discard(contentKey, ownerId);
    last.current.content = conflict.content;
    setSeed(conflict.content);
    // The live state no longer matches their text: a new session seeds from it.
    if (coediting) setGeneration((count) => count + 1);
    showConflict(null);
  };

  const uploadAsset = async (file: File) => {
    try {
      return await uploadDocumentFile({ workspaceId, documentId: id, file });
    } catch (error) {
      if (error instanceof HttpError && error.status === 415) {
        throw new Error(t("navigation:documents.upload.typeNotAllowed"));
      }
      throw error;
    }
  };

  const bodyProps = {
    onChange: readOnly
      ? undefined
      : (value: string, change?: { remote: boolean }) =>
          schedule("content", value, change),
    readOnly,
    uploadAsset: readOnly ? undefined : uploadAsset,
    showBubbleMenu: !readOnly,
    bubbleMenuExtra: (editor: Editor) => (
      <ChecklistIssuesButton
        editor={editor}
        onOpen={(from, lines) => setChecklist({ editor: from, lines })}
      />
    ),
    placeholder: t("navigation:documents.bodyPlaceholder"),
    slashMenuPosition: "fixed" as const,
    className: bodyClass,
  };

  const editorName = document.updatedByName ?? document.creatorName;
  const conflictName = conflict?.updatedByName ?? conflict?.creatorName ?? "";
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
        <span className="sm:hidden">
          <DocumentKindMenu document={document} />
        </span>
        {readOnly && (
          <span className="ml-1 rounded border border-border px-1 text-[11px]">
            {t("navigation:documents.viewOnly")}
          </span>
        )}
        <DocumentEditingIndicator documentId={id} />
        {conflict && (
          <DocumentConflictBanner
            name={conflictName}
            onReview={() => setReviewing(true)}
          />
        )}
        {failed && !conflict && (
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
        {coediting ? (
          <DocumentCollabBody
            {...bodyProps}
            workspaceId={workspaceId}
            documentId={id}
            generation={generation}
            user={{ id: user?.id ?? "", name: user?.name ?? "" }}
          />
        ) : (
          <CommentEditor {...bodyProps} value={seed} />
        )}
      </div>
      {conflict && reviewing && (
        <DocumentConflictDialog
          name={conflictName}
          theirs={conflict.content}
          mine={last.current.content}
          onKeepMine={keepMine}
          onUseTheirs={takeTheirs}
          onClose={() => setReviewing(false)}
        />
      )}
      {checklist && (
        <ChecklistToIssuesDialog
          document={document}
          {...checklist}
          onClose={() => setChecklist(null)}
        />
      )}
    </div>
  );
}
