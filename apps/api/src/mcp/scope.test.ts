import { expect, it } from "vite-plus/test";
import { scopedSessionAllows } from "./scope";

it.each([
  ["GET", "/api/task/abc"],
  ["HEAD", "/api/workspace"],
  ["get", "/api/project"],
  // Every read the assistant tools make.
  ["GET", "/api/activity/t1"],
  ["GET", "/api/column/p1"],
  ["GET", "/api/comment/t1"],
  ["GET", "/api/custom-field/project/p1"],
  ["GET", "/api/document/workspace/w1"],
  ["GET", "/api/label/workspace/w1"],
  ["GET", "/api/notification"],
  ["GET", "/api/search"],
  ["GET", "/api/task-relation/t1"],
  ["GET", "/api/time-entry/task/t1"],
  ["GET", "/api/topic/workspace/w1/t1"],
  ["GET", "/api/user/me"],
  ["GET", "/api/workspace/w1/members"],
  ["POST", "/api/document"],
  ["PUT", "/api/document/abc"],
  ["DELETE", "/api/document/abc/comment/1"],
  ["POST", "/api/topic"],
  ["POST", "/api/topic/abc/current"],
  ["POST", "/api/topic/workspace/w1/t1/slots"],
  ["DELETE", "/api/topic/workspace/w1/t1/slots/s1"],
  ["GET", "/api/document/workspace/w1/d1/statements"],
  ["POST", "/api/document/workspace/w1/d1/statements"],
  ["GET", "/api/document/workspace/w1/d1/receipt"],
  ["POST", "/api/document/workspace/w1/d1/conflicts/c1/decide"],
  ["PUT", "/api/document/workspace/w/d/statements/s/dependents"],
  ["DELETE", "/api/document/workspace/w/d/statements/s/dependents/x"],
  ["GET", "/api/topic/workspace/w/needs-review"],
  ["POST", "/api/topic/workspace/w/needs-review/x/clear"],
  ["GET", "/api/auth/get-session"],
  ["GET", "/api/auth/organization/list"],
  ["POST", "/api/auth/sign-out"],
])("allows %s %s", (method, path) => {
  expect(scopedSessionAllows(method, path)).toBe(true);
});

it.each([
  ["POST", "/api/task/abc"],
  ["PUT", "/api/project/abc"],
  ["DELETE", "/api/project/abc"],
  ["PATCH", "/api/workspace/abc"],
  // A path that only starts with the same letters is another router.
  ["POST", "/api/documentx"],
  ["POST", "/api/topics"],
  ["POST", "/api/document-export"],
  // Under /auth a read can reveal a full session, so it is refused too.
  ["GET", "/api/auth/list-sessions"],
  ["GET", "/api/auth/api-key/list"],
  ["GET", "/api/auth/device"],
  ["POST", "/api/auth/get-session"],
  ["POST", "/api/auth/api-key/create"],
  ["POST", "/api/auth/device/approve"],
  ["POST", "/api/auth/sign-out/"],
  ["POST", "/api/auth"],
  // A read outside the listed routers is refused: some GET handlers write
  // or return a credential.
  ["GET", "/api/github-reviews/connect"],
  ["GET", "/api/github-reviews/callback"],
  ["GET", "/api/oauth/id-token"],
  ["GET", "/api/cycle/project/p1"],
  ["GET", "/api/billing/w1"],
  ["HEAD", "/api/billing/w1"],
  ["GET", "/api/user/sessions"],
  ["GET", "/api/calendar-feed/project/p1"],
  ["GET", "/api/github-integration/project/p1"],
  ["GET", "/api/projects"],
  ["GET", "/api/unknown"],
  ["GET", "/api"],
  // An unknown method is a write.
  ["PROPFIND", "/api/task/abc"],
])("refuses %s %s", (method, path) => {
  expect(scopedSessionAllows(method, path)).toBe(false);
});
