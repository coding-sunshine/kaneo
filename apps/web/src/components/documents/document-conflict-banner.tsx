import { useTranslation } from "react-i18next";

type DocumentConflictBannerProps = { name: string; onReview: () => void };

/** Someone else saved the text while this person was typing. */
export function DocumentConflictBanner({
  name,
  onReview,
}: DocumentConflictBannerProps) {
  const { t } = useTranslation();
  return (
    <span role="alert" className="ml-1 text-destructive">
      {t("navigation:documents.conflict.banner", { name })}{" "}
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={onReview}
      >
        {t("navigation:documents.conflict.review")}
      </button>
    </span>
  );
}
