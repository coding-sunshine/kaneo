type BriefTicket = {
  id: string;
  title: string;
  ticket: string;
  projectId: string;
};

/** A daily brief lists tickets and messages, never people. */
export type DailyBriefContent = {
  dueToday: BriefTicket[];
  mentions: {
    messageId: string;
    channelId: string;
    channelName: string;
    preview: string;
    createdAt: string;
  }[];
  moved: (BriefTicket & { status: string })[];
};
