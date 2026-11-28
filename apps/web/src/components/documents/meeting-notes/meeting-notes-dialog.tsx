import { useMutation } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HeaderIconButton } from "@/components/task/header/header-icon-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  proposeMeetingNotes,
  transcribeMeeting,
} from "@/fetchers/meeting-notes/meeting-notes";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import { HttpError } from "@/lib/http-error";
import { ProposalCard } from "./proposal-card";

const isOff = (error: unknown) =>
  error instanceof HttpError && error.status === 404;

/**
 * Notes from a pasted transcript or a recording. By default the transcript
 * is not kept: it lives in this dialog and the one request that reads it.
 */
export function MeetingNotesDialog({
  workspaceId,
  documentId,
}: {
  workspaceId: string;
  documentId: string;
}) {
  const { t } = useTranslation();
  const hasAgent = useHasAgent();
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [keep, setKeep] = useState(false);
  const notes = useMutation({
    mutationFn: () =>
      proposeMeetingNotes(workspaceId, documentId, transcript, keep),
  });
  const audio = useMutation({
    mutationFn: (file: File) => transcribeMeeting(workspaceId, file),
    onSuccess: (result) => setTranscript(result.transcript),
  });

  return (
    <>
      <HeaderIconButton
        label={t("navigation:documents.meetingNotes.open")}
        onClick={() => setOpen(true)}
      >
        <NotebookPen aria-hidden />
      </HeaderIconButton>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            notes.reset();
            audio.reset();
            setTranscript("");
          }
        }}
      >
        <DialogPopup className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("navigation:documents.meetingNotes.title")}
            </DialogTitle>
            <DialogDescription>
              {t("navigation:documents.meetingNotes.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            {!hasAgent || isOff(notes.error) ? (
              <p role="status" className="text-muted-foreground text-sm">
                {t("navigation:documents.meetingNotes.off")}
              </p>
            ) : notes.data ? (
              <ProposalCard
                workspaceId={workspaceId}
                documentId={documentId}
                proposal={notes.data}
                keep={keep}
              />
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meeting-transcript">
                    {t("navigation:documents.meetingNotes.transcript")}
                  </Label>
                  <Textarea
                    id="meeting-transcript"
                    value={transcript}
                    rows={10}
                    maxLength={100_000}
                    onChange={(event) => setTranscript(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meeting-audio">
                    {t("navigation:documents.meetingNotes.audio")}
                  </Label>
                  <input
                    id="meeting-audio"
                    type="file"
                    accept="audio/*,video/*"
                    className="text-sm"
                    disabled={audio.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) audio.mutate(file);
                    }}
                  />
                  {audio.isPending && (
                    <p role="status" className="text-muted-foreground text-xs">
                      {t("navigation:documents.meetingNotes.transcribing")}
                    </p>
                  )}
                  {audio.isError && (
                    <p
                      role={isOff(audio.error) ? "status" : "alert"}
                      className="text-muted-foreground text-xs"
                    >
                      {isOff(audio.error)
                        ? t("navigation:documents.meetingNotes.audioOff")
                        : audio.error.message}
                    </p>
                  )}
                </div>
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={keep}
                    onCheckedChange={(checked) => setKeep(checked === true)}
                  />
                  {t("navigation:documents.meetingNotes.keep")}
                </Label>
                {notes.isError && (
                  <p role="alert" className="text-destructive text-sm">
                    {notes.error.message}
                  </p>
                )}
                <Button
                  size="sm"
                  className="self-start"
                  disabled={transcript.trim().length < 20 || notes.isPending}
                  onClick={() => notes.mutate()}
                >
                  {notes.isPending
                    ? t("navigation:documents.meetingNotes.running")
                    : t("navigation:documents.meetingNotes.run")}
                </Button>
              </>
            )}
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
