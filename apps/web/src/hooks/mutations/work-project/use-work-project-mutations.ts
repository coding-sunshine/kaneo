import { useMutation, useQueryClient } from "@tanstack/react-query";
import createWorkProject from "@/fetchers/work-project/create-work-project";
import deleteWorkProject from "@/fetchers/work-project/delete-work-project";
import {
  createMilestone,
  deleteMilestone,
  type UpdateMilestoneInput,
  updateMilestone,
  type CreateMilestoneInput,
} from "@/fetchers/work-project/milestones";
import {
  type AddWorkProjectLinkInput,
  addWorkProjectLink,
  removeWorkProjectLink,
} from "@/fetchers/work-project/links";
import type { UpdateWorkProjectInput } from "@/fetchers/work-project/types";
import {
  type CreateUpdateInput,
  createWorkProjectUpdate,
  deleteWorkProjectUpdate,
  type EditUpdateInput,
  editWorkProjectUpdate,
} from "@/fetchers/work-project/updates";
import updateWorkProject from "@/fetchers/work-project/update-work-project";
import {
  addWorkProjectDependency,
  removeWorkProjectDependency,
} from "@/fetchers/work-project/dependencies";
import { invalidateWorkProjects } from "./invalidate-work-projects";

export function useCreateWorkProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkProject,
    onSuccess: () => invalidateWorkProjects(queryClient),
  });
}

export function useUpdateWorkProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: UpdateWorkProjectInput) => updateWorkProject(id, json),
    onSuccess: () => invalidateWorkProjects(queryClient, id),
  });
}

export function useDeleteWorkProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkProject,
    onSuccess: () => invalidateWorkProjects(queryClient),
  });
}

export function useCreateMilestone(workProjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: CreateMilestoneInput) =>
      createMilestone(workProjectId, json),
    onSuccess: () => invalidateWorkProjects(queryClient, workProjectId),
  });
}

export function useUpdateMilestone(workProjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...json }: UpdateMilestoneInput & { id: string }) =>
      updateMilestone(id, json),
    onSuccess: () => invalidateWorkProjects(queryClient, workProjectId),
  });
}

export function useDeleteMilestone(workProjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMilestone,
    onSuccess: () => invalidateWorkProjects(queryClient, workProjectId),
  });
}

export function useAddWorkProjectLink(workProjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: AddWorkProjectLinkInput) =>
      addWorkProjectLink(workProjectId, json),
    onSuccess: () => invalidateWorkProjects(queryClient, workProjectId),
  });
}

export function useRemoveWorkProjectLink(workProjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      removeWorkProjectLink(workProjectId, linkId),
    onSuccess: () => invalidateWorkProjects(queryClient, workProjectId),
  });
}

export function useCreateWorkProjectUpdate(workProjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: CreateUpdateInput) =>
      createWorkProjectUpdate(workProjectId, json),
    // The post also moves the project's health shown in lists and details.
    onSuccess: () => invalidateWorkProjects(queryClient, workProjectId),
  });
}

export function useEditWorkProjectUpdate(workProjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...json }: EditUpdateInput & { id: string }) =>
      editWorkProjectUpdate(id, json),
    onSuccess: () => invalidateWorkProjects(queryClient, workProjectId),
  });
}

export function useDeleteWorkProjectUpdate(workProjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkProjectUpdate,
    onSuccess: () => invalidateWorkProjects(queryClient, workProjectId),
  });
}

type Dependency = { id: string; dependsOnId: string };

// Both ends of a dependency show it, so every project is refreshed.
export function useAddWorkProjectDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dependsOnId }: Dependency) =>
      addWorkProjectDependency(id, dependsOnId),
    onSuccess: () => invalidateWorkProjects(queryClient),
  });
}

export function useRemoveWorkProjectDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dependsOnId }: Dependency) =>
      removeWorkProjectDependency(id, dependsOnId),
    onSuccess: () => invalidateWorkProjects(queryClient),
  });
}
