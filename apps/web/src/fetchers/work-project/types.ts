import type { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

type Api = (typeof client)["work-project"];

export type WorkProject = InferResponseType<
  Api["workspace"][":workspaceId"]["$get"],
  200
>[number];

export type WorkProjectDetail = InferResponseType<Api[":id"]["$get"], 200>;

export type WorkProjectMilestone = WorkProjectDetail["milestones"][number];

export type CreateWorkProjectInput = InferRequestType<Api["$post"]>["json"];

export type UpdateWorkProjectInput = InferRequestType<
  Api[":id"]["$put"]
>["json"];

export type WorkProjectStatus = NonNullable<CreateWorkProjectInput["status"]>;

export type WorkProjectUpdate = InferResponseType<
  Api[":id"]["update"]["$get"],
  200
>[number];

export type WorkProjectComment = InferResponseType<
  Api[":id"]["comment"]["$get"],
  200
>[number];
