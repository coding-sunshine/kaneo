import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Topic } from "@/fetchers/topic/topics";
import { EditTopicDialog } from "./edit-topic-dialog";

/** For the decider and workspace owners: rename the topic, name its deciders. */
export function EditTopicButton({ topic }: { topic: Topic }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!topic.canManage) return null;
  return (
    <>
      <Button
        size="xs"
        variant="outline"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden />
        {t("navigation:documents.topics.edit.action")}
      </Button>
      {open && <EditTopicDialog topic={topic} onClose={() => setOpen(false)} />}
    </>
  );
}
