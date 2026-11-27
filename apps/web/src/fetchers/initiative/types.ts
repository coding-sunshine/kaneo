import type { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

type Api = (typeof client)["initiative"];

export type Initiative = InferResponseType<
  Api["workspace"][":workspaceId"]["$get"],
  200
>[number];

export type InitiativeDetail = InferResponseType<Api[":id"]["$get"], 200>;

export type CreateInitiativeInput = InferRequestType<Api["$post"]>["json"];

export type UpdateInitiativeInput = InferRequestType<
  Api[":id"]["$put"]
>["json"];

export type InitiativeUpdate = InferResponseType<
  Api[":id"]["update"]["$get"],
  200
>[number];

export type CreateInitiativeUpdateInput = InferRequestType<
  Api[":id"]["update"]["$post"]
>["json"];
