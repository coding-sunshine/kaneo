import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client["project-label"];

async function ok<T extends Response>(response: T) {
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response;
}

export async function getProjectLabels(workspaceId: string) {
  const response = await ok(
    await api.workspace[":workspaceId"].$get({ param: { workspaceId } }),
  );
  const labels = await response.json();
  if (!Array.isArray(labels)) throw new Error("Could not load project labels");
  return labels;
}

export async function createProjectLabel(json: {
  workspaceId: string;
  name: string;
  color: string;
}) {
  return (await ok(await api.$post({ json }))).json();
}

export async function updateProjectLabel({
  id,
  ...json
}: {
  id: string;
  name: string;
  color: string;
}) {
  return (await ok(await api[":id"].$put({ param: { id }, json }))).json();
}

export async function deleteProjectLabel(id: string) {
  return (await ok(await api[":id"].$delete({ param: { id } }))).json();
}

export async function setProjectLabelOnProject({
  labelId,
  workProjectId,
  attached,
}: {
  labelId: string;
  workProjectId: string;
  attached: boolean;
}) {
  const response = attached
    ? await api[":id"]["work-project"].$put({
        param: { id: labelId },
        json: { workProjectId },
      })
    : await api[":id"]["work-project"][":workProjectId"].$delete({
        param: { id: labelId, workProjectId },
      });
  return (await ok(response)).json();
}
