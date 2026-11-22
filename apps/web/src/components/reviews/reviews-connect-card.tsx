import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";
import { getReviewsConnectUrl } from "@/fetchers/github-reviews/github-reviews";

export type ReviewsConnectState =
  | "not_configured"
  | "not_connected"
  | "needs_reconnect";

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-[62px] items-center justify-center rounded-2xl border border-border bg-background shadow-xs">
      {children}
    </span>
  );
}

export function ReviewsConnectCard({
  state,
  returnTo,
}: {
  state: ReviewsConnectState;
  returnTo: string;
}) {
  const { t } = useTranslation();
  const key =
    state === "needs_reconnect"
      ? "reconnect"
      : state === "not_connected"
        ? "connect"
        : "notConfigured";

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        data-testid="reviews-connect-card"
        className="flex w-full max-w-md flex-col items-center gap-5 rounded-xl border bg-card p-8 text-center"
      >
        <div className="flex items-center gap-2" aria-hidden="true">
          <Tile>
            <GithubIcon className="size-8" />
          </Tile>
          <span className="w-8 border-muted-foreground/60 border-t-2 border-dotted" />
          <Tile>
            <img src="/favicon.svg" alt="" className="size-8" />
          </Tile>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-semibold text-foreground text-base">
            {t(`workspace:reviews.${key}.title`)}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(`workspace:reviews.${key}.description`)}
          </p>
        </div>
        {state !== "not_configured" && (
          <Button render={<a href={getReviewsConnectUrl(returnTo)} />}>
            <GithubIcon />
            {t(`workspace:reviews.${key}.action`)}
          </Button>
        )}
      </div>
    </div>
  );
}
