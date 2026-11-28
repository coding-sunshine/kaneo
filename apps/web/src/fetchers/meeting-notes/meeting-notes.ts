import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client["meeting-notes"].workspace[":workspaceId"];

export async function proposeMeetingNotes(
  workspaceId: string,
  documentId: string,
  transcript: string,
  keep: boolean,
) {
  const response = await api.documents[":documentId"].notes.$post({
    param: { workspaceId, documentId },
    json: { transcript, keep },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function acceptMeetingNotes(
  workspaceId: string,
  documentId: string,
  projectId: string,
  items: { title: string; description?: string }[],
) {
  const response = await api.documents[":documentId"].accept.$post({
    param: { workspaceId, documentId },
    json: { projectId, items },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function transcribeMeeting(workspaceId: string, file: File) {
  const response = await api.transcribe.$post({
    param: { workspaceId },
    form: { file },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type MeetingNotesProposal = Awaited<
  ReturnType<typeof proposeMeetingNotes>
>;
