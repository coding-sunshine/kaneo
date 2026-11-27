type Translate = (key: string) => string;

// The templates every workspace has. Their headings follow the reader's
// language at the moment the document is made.
export const BUILT_IN_TEMPLATES = [
  {
    id: "meetingNotes",
    name: "navigation:documents.templates.builtIn.meetingNotes.name",
    hint: "navigation:documents.templates.builtIn.meetingNotes.hint",
    headings: [
      "navigation:documents.templates.headings.attendees",
      "navigation:documents.templates.headings.agenda",
      "navigation:documents.templates.headings.notes",
      "navigation:documents.templates.headings.decisions",
      "navigation:documents.templates.headings.actionItems",
    ],
  },
  {
    id: "runbook",
    name: "navigation:documents.templates.builtIn.runbook.name",
    hint: "navigation:documents.templates.builtIn.runbook.hint",
    headings: [
      "navigation:documents.templates.headings.overview",
      "navigation:documents.templates.headings.whenToUse",
      "navigation:documents.templates.headings.prerequisites",
      "navigation:documents.templates.headings.steps",
      "navigation:documents.templates.headings.rollback",
      "navigation:documents.templates.headings.contacts",
    ],
  },
  {
    id: "postmortem",
    name: "navigation:documents.templates.builtIn.postmortem.name",
    hint: "navigation:documents.templates.builtIn.postmortem.hint",
    headings: [
      "navigation:documents.templates.headings.summary",
      "navigation:documents.templates.headings.impact",
      "navigation:documents.templates.headings.timeline",
      "navigation:documents.templates.headings.rootCause",
      "navigation:documents.templates.headings.wentWell",
      "navigation:documents.templates.headings.wentWrong",
      "navigation:documents.templates.headings.actionItems",
    ],
  },
  {
    id: "rfc",
    name: "navigation:documents.templates.builtIn.rfc.name",
    hint: "navigation:documents.templates.builtIn.rfc.hint",
    headings: [
      "navigation:documents.templates.headings.summary",
      "navigation:documents.templates.headings.motivation",
      "navigation:documents.templates.headings.proposal",
      "navigation:documents.templates.headings.alternatives",
      "navigation:documents.templates.headings.openQuestions",
    ],
  },
] as const;

export type BuiltInTemplate = (typeof BUILT_IN_TEMPLATES)[number];

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** The document text: each heading with an empty paragraph to write in. */
export const builtInContent = (template: BuiltInTemplate, t: Translate) =>
  template.headings
    .map((heading) => `<h2>${escapeHtml(t(heading))}</h2><p></p>`)
    .join("");
