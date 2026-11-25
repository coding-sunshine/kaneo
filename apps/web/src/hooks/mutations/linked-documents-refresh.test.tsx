import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { documentListKey } from "@/hooks/queries/document/use-documents";
import type Task from "@/types/task";
import useCreateComment from "./comment/use-create-comment";
import useDeleteComment from "./comment/use-delete-comment";
import useUpdateComment from "./comment/use-update-comment";
import { useUpdateTaskDescription } from "./task/use-update-task-description";

vi.mock("@/fetchers/comment/create-comment", () => ({ default: vi.fn() }));
vi.mock("@/fetchers/comment/update-comment", () => ({ default: vi.fn() }));
vi.mock("@/fetchers/comment/delete-comment", () => ({ default: vi.fn() }));
vi.mock("@/fetchers/task/update-task-description", () => ({
  default: vi.fn(async () => ({ description: "" })),
}));

const task = { id: "t1", projectId: "p1" } as Task;
// The four hooks take different things; the test only needs to run each one.
type Saver = () => { mutateAsync: (variables: never) => Promise<unknown> };
const linked = documentListKey("w1", { linkedTaskId: "t1" });
const attached = documentListKey("w1", { taskId: "t1" });

// The server tells every other open page. The page that saved has to ask again
// itself.
describe("the documents linked with an issue, after its text is saved", () => {
  it.each([
    ["a new comment", useCreateComment, { taskId: "t1", comment: "x" }],
    ["an edited comment", useUpdateComment, { activityId: "a1", comment: "x" }],
    ["a deleted comment", () => useDeleteComment("t1"), { activityId: "a1" }],
    ["a saved description", useUpdateTaskDescription, task],
  ] as [string, Saver, unknown][])(
    "are read again after %s",
    async (_name, useHook, variables) => {
      const queryClient = new QueryClient();
      queryClient.setQueryData(linked, []);
      queryClient.setQueryData(attached, []);
      const { result } = renderHook(() => useHook(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      await act(() => result.current.mutateAsync(variables as never));

      expect(queryClient.getQueryState(linked)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(attached)?.isInvalidated).toBe(false);
    },
  );
});
