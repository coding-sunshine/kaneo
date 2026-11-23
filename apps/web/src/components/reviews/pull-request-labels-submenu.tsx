import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MenuCheckboxItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";
import {
  useRepoLabels,
  useSetPullRequestLabels,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { toast } from "@/lib/toast";

type Label = { name: string; color: string };

function LabelOptions({
  pullRef,
  current,
}: {
  pullRef: PullRef;
  current: Label[];
}) {
  const { t } = useTranslation();
  const labels = useRepoLabels(pullRef, true);
  const setLabels = useSetPullRequestLabels(pullRef);
  const names = new Set(current.map((label) => label.name));

  const toggle = (name: string, on: boolean) => {
    const next = new Set(names);
    if (on) next.add(name);
    else next.delete(name);
    setLabels.mutate([...next], { onError: (e) => toast.error(e.message) });
  };

  if (labels.isError || labels.data?.length === 0) {
    return (
      <p className="px-2 py-1.5 text-muted-foreground text-sm">
        {t(
          labels.isError
            ? "workspace:reviews.loadError"
            : "workspace:reviews.prActions.noLabels",
        )}
      </p>
    );
  }
  return (
    <>
      {(labels.data ?? []).map((label) => (
        <MenuCheckboxItem
          key={label.name}
          checked={names.has(label.name)}
          disabled={setLabels.isPending}
          closeOnClick={false}
          onCheckedChange={(on) => toggle(label.name, on)}
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: `#${label.color}` }}
            />
            {label.name}
          </span>
        </MenuCheckboxItem>
      ))}
    </>
  );
}

/** Labels submenu: the repo's GitHub labels as checkboxes; a toggle rewrites the pull request's set. */
export function PullRequestLabelsSubmenu({
  pullRef,
  labels,
}: {
  pullRef: PullRef;
  labels: Label[];
}) {
  const { t } = useTranslation();
  return (
    <MenuSub>
      <MenuSubTrigger>
        <Tag />
        {t("workspace:reviews.prActions.labels")}
      </MenuSubTrigger>
      <MenuSubPopup className="max-h-80 min-w-52 overflow-y-auto">
        <LabelOptions pullRef={pullRef} current={labels} />
      </MenuSubPopup>
    </MenuSub>
  );
}
