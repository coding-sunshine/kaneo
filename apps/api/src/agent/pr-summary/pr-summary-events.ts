import { subscribeToEvent } from "../../events";
import {
  type MergedPullRequest,
  summarizePullRequest,
} from "./summarize-pull-request";

// A summary never fails the webhook that reported the merge.
subscribeToEvent<MergedPullRequest>("pull_request.merged", (pull) =>
  summarizePullRequest(pull).catch((error: unknown) => {
    console.error("Pull request summary failed:", error);
  }),
);
