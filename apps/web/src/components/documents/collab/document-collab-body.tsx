import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { type ComponentProps, useMemo } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { caretColor } from "./caret-color";
import { useCollabSession } from "./use-collab-session";

type EditorProps = ComponentProps<typeof CommentEditor>;

type DocumentCollabBodyProps = Omit<EditorProps, "value" | "collaboration"> & {
  workspaceId: string;
  documentId: string;
  /** Bumped to drop the session, e.g. after taking someone else's text. */
  generation: number;
  user: { id: string; name: string };
};

/** The document body while several people edit it at once. */
export function DocumentCollabBody({
  workspaceId,
  documentId,
  generation,
  user,
  ...editorProps
}: DocumentCollabBodyProps) {
  const { t } = useTranslation();
  const { session, status } = useCollabSession(
    workspaceId,
    documentId,
    generation,
  );
  const collaboration = useMemo(
    () =>
      session && [
        Collaboration.configure({ document: session.doc }),
        CollaborationCaret.configure({
          provider: { awareness: session.awareness },
          user: { name: user.name, color: caretColor(user.id) },
        }),
      ],
    [session, user.id, user.name],
  );

  if (status === "failed")
    return (
      <p role="alert" className="text-destructive text-sm">
        {t("navigation:documents.coediting.failed")}
      </p>
    );
  if (status !== "ready" || !session || !collaboration)
    return (
      <p className="text-muted-foreground text-sm">
        {t("navigation:documents.coediting.loading")}
      </p>
    );
  return (
    <CommentEditor
      key={session.doc.guid}
      value=""
      collaboration={collaboration}
      {...editorProps}
    />
  );
}
