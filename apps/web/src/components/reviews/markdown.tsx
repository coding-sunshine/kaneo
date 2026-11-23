import CommentEditor from "@/components/activity/comment-editor";

// The same read-only ProseMirror renderer issue comments use; it builds nodes
// from markdown rather than injecting GitHub's text as HTML.
export function Markdown({ value }: { value: string }) {
  return (
    <CommentEditor
      value={value}
      readOnly
      className="kaneo-comment-viewer [&_.kaneo-comment-editor-content_.ProseMirror]:p-0"
    />
  );
}
