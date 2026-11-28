/** Decisions and proposed tickets read from a meeting, each with its quote. */
export type MeetingNotesProposal = {
  decisions: { text: string; quote: string }[];
  actionItems: { title: string; description: string; quote: string }[];
};
