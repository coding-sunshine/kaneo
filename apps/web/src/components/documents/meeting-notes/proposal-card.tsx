import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  acceptMeetingNotes,
  type MeetingNotesProposal,
} from "@/fetchers/meeting-notes/meeting-notes";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { toast } from "@/lib/toast";

type ProposalCardProps = {
  workspaceId: string;
  documentId: string;
  proposal: MeetingNotesProposal;
  /** Quotes go into the tickets only when the transcript is kept. */
  keep: boolean;
};

/** Decisions and proposed tickets, each with the words it came from. */
export function ProposalCard({
  workspaceId,
  documentId,
  proposal,
  keep,
}: ProposalCardProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const [chosen, setChosen] = useState(() =>
    proposal.actionItems.map((_, index) => index),
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const accept = useMutation({
    mutationFn: (teamId: string) =>
      acceptMeetingNotes(
        workspaceId,
        documentId,
        teamId,
        proposal.actionItems
          .filter((_, index) => chosen.includes(index))
          .map((item) => ({
            title: item.title,
            description: keep
              ? [item.description, `> ${item.quote}`]
                  .filter(Boolean)
                  .join("\n\n")
              : item.description,
          })),
      ),
    onSuccess: ({ tasks }) =>
      toast.success(
        t("navigation:documents.meetingNotes.created", {
          count: tasks.length,
        }),
      ),
    onError: (error) => toast.error(error.message),
  });
  const team = projects.find((project) => project.id === projectId);

  return (
    <section
      aria-label={t("navigation:documents.meetingNotes.proposal")}
      className="flex flex-col gap-4 rounded-md border border-border/70 bg-muted/20 p-3 text-sm"
    >
      <div className="flex flex-col gap-2">
        <h3 className="font-medium">
          {t("navigation:documents.meetingNotes.decisions")}
        </h3>
        {proposal.decisions.length === 0 ? (
          <p className="text-muted-foreground">
            {t("navigation:documents.meetingNotes.noDecisions")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {proposal.decisions.map((decision) => (
              <li key={decision.text + decision.quote}>
                <p>{decision.text}</p>
                <blockquote className="border-l-2 pl-2 text-muted-foreground text-xs">
                  {decision.quote}
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">
          {t("navigation:documents.meetingNotes.actionItems")}
        </legend>
        {proposal.actionItems.length === 0 && (
          <p className="text-muted-foreground">
            {t("navigation:documents.meetingNotes.noActionItems")}
          </p>
        )}
        {proposal.actionItems.map((item, index) => (
          <Label
            key={item.title + item.quote}
            className="flex items-start gap-2 font-normal"
          >
            <Checkbox
              checked={chosen.includes(index)}
              onCheckedChange={(checked) =>
                setChosen((list) =>
                  checked ? [...list, index] : list.filter((i) => i !== index),
                )
              }
            />
            <span className="flex flex-col gap-1">
              <span className="font-medium">{item.title}</span>
              {item.description && <span>{item.description}</span>}
              <blockquote className="border-l-2 pl-2 text-muted-foreground text-xs">
                {item.quote}
              </blockquote>
            </span>
          </Label>
        ))}
      </fieldset>
      {proposal.actionItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={projectId}
            onValueChange={(next) => setProjectId(next as string | null)}
          >
            <SelectTrigger
              size="sm"
              className="w-48"
              aria-label={t("navigation:documents.meetingNotes.project")}
            >
              <SelectValue>
                {team?.name ?? t("navigation:documents.meetingNotes.project")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={
              !projectId ||
              chosen.length === 0 ||
              accept.isPending ||
              accept.isSuccess
            }
            onClick={() => projectId && accept.mutate(projectId)}
          >
            {t("navigation:documents.meetingNotes.accept", {
              count: chosen.length,
            })}
          </Button>
        </div>
      )}
    </section>
  );
}
