import { Link } from "@tanstack/react-router";
import { Circle, CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { checklistItemLink } from "./checklist-item-link";

type ChecklistItemRowProps = {
  label: string;
  done: boolean;
  link: ReturnType<typeof checklistItemLink>;
  onFollow?: () => void;
};

export function ChecklistItemRow({
  label,
  done,
  link,
  onFollow,
}: ChecklistItemRowProps) {
  const { t } = useTranslation();
  const Icon = done ? CircleCheck : Circle;
  const text = (
    <span className={cn(done && "text-muted-foreground line-through")}>
      {label}
    </span>
  );

  return (
    <li className="flex items-center gap-2.5 text-sm">
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          done ? "text-primary" : "text-muted-foreground",
        )}
      />
      {link ? (
        <Link
          {...link}
          onClick={onFollow}
          className="text-foreground hover:underline"
        >
          {text}
        </Link>
      ) : (
        text
      )}
      {done && (
        <span className="sr-only">{t("workspace:home.checklist.done")}</span>
      )}
    </li>
  );
}
