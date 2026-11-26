import { ExternalLink, Link2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { linkHost } from "@/components/external-links/link-host";
import type { WorkProjectLink } from "@/fetchers/work-project/types";
import { useRemoveWorkProjectLink } from "@/hooks/mutations/work-project/use-work-project-mutations";
import { toast } from "@/lib/toast";

type Props = {
  link: WorkProjectLink;
  workProjectId: string;
  editable: boolean;
};

const chip = "flex min-w-0 items-center gap-1.5";

/** One project link as a chip. Only web addresses and in-app paths become links. */
export function WorkProjectLinkChip({ link, workProjectId, editable }: Props) {
  const { t } = useTranslation();
  const remove = useRemoveWorkProjectLink(workProjectId);
  const isWeb = /^https?:\/\//i.test(link.url);
  const isPath = link.url.startsWith("/") && !link.url.startsWith("//");
  const text = link.label || (isWeb && linkHost(link.url)) || link.url;
  const title = link.label || link.url;

  return (
    <span className="flex h-6 max-w-74 items-center gap-1 rounded-full px-1.5 focus-within:bg-accent hover:bg-accent">
      {isWeb || isPath ? (
        <a
          href={link.url}
          {...(isWeb && { target: "_blank", rel: "noopener noreferrer" })}
          className={`${chip} outline-none`}
        >
          {isWeb ? (
            <ExternalLink
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground"
            />
          ) : (
            <Link2
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground"
            />
          )}
          <span className="truncate">{text}</span>
        </a>
      ) : (
        <span className={chip}>
          <span className="truncate">{text}</span>
        </span>
      )}
      {editable && (
        <button
          type="button"
          aria-label={t("settings:externalLinks.remove", { title })}
          title={t("settings:externalLinks.remove", { title })}
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(link.id, {
              onError: () =>
                toast.error(t("settings:externalLinks.removeError")),
            })
          }
          className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      )}
    </span>
  );
}
