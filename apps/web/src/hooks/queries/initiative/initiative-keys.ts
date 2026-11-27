// Under "work-projects" so a project change (health, issues) refreshes the
// initiatives that roll it up.
export const initiativeKeys = {
  all: ["work-projects", "initiatives"] as const,
  list: (workspaceId: string) =>
    ["work-projects", "initiatives", "list", workspaceId] as const,
  detail: (id: string) =>
    ["work-projects", "initiatives", "detail", id] as const,
  updates: (id: string) =>
    ["work-projects", "initiatives", "updates", id] as const,
  pulse: (workspaceId: string) =>
    ["work-projects", "initiatives", "pulse", workspaceId] as const,
};
