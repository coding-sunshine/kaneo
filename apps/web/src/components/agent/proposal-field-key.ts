const KEYS: Record<string, string> = {
  priority: "navigation:agent.proposal.fields.priority",
  labels: "navigation:agent.proposal.fields.labels",
  status: "navigation:agent.proposal.fields.status",
  title: "navigation:agent.proposal.fields.title",
  description: "navigation:agent.proposal.fields.description",
  assignee: "navigation:agent.proposal.fields.assignee",
  team: "navigation:agent.proposal.fields.team",
  startDate: "navigation:agent.proposal.fields.startDate",
  dueDate: "navigation:agent.proposal.fields.dueDate",
  comment: "navigation:agent.proposal.fields.comment",
  topic: "navigation:agent.proposal.fields.topic",
  position: "navigation:agent.proposal.fields.position",
  provider: "navigation:agent.proposal.fields.provider",
  model: "navigation:agent.proposal.fields.model",
};

/** The i18n key naming a diff field; an unknown field shows as it is. */
export const proposalFieldKey = (field: string) => KEYS[field] ?? null;
