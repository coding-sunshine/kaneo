/** What each writing action asks the model to do with the selection. */
export const WRITING_ACTIONS = {
  shorten: "Make it shorter: keep every fact and decision, drop the rest.",
  lengthen: "Make it longer and more complete, without inventing facts.",
  simplify: "Use simpler words and shorter sentences; keep the meaning.",
  fix: "Fix spelling, grammar and punctuation; change nothing else.",
  professional: "Make the tone clear and professional; keep the meaning.",
} as const;

export type WritingAction = keyof typeof WRITING_ACTIONS;
