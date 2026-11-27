import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { logMissingCalendarKeys } from "./config";
import { findConnection } from "./connection";
import { callback } from "./controllers/callback";
import { connect } from "./controllers/connect";
import { createEvent } from "./controllers/create-event";
import { getStatus } from "./controllers/get-status";
import { listEvents } from "./controllers/list-events";
import {
  disconnectedSchema,
  eventListSchema,
  externalEventSchema,
  statusSchema,
  syncedSchema,
} from "./response";
import {
  callbackQuery,
  connectQuery,
  createEventBody,
  eventsQuery,
  providerParam,
} from "./schema";
import { removeConnection, syncUserTasks } from "./task-events";
import "./subscribers";

logMissingCalendarKeys();

const tags = ["Calendar sync"];
// The calendar acts as the signed-in person, so API keys are refused.
const needsSession = errorResponse("A user session is required");
const notConfigured = errorResponse(
  "Calendar sync is not configured for this provider",
);

const statusRoute = createRoute({
  method: "get",
  operationId: "getCalendarSyncStatus",
  path: "/status",
  tags,
  summary: "Get calendar connection status",
  description:
    "For Google and Microsoft: whether the instance has keys for it and whether the signed-in user has a working connection.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("Connection status", statusSchema),
    403: needsSession,
  },
});

const connectRoute = createRoute({
  method: "get",
  operationId: "connectCalendar",
  path: "/connect/{provider}",
  tags,
  summary: "Connect a calendar",
  description:
    "Starts the provider's authorization for the signed-in user and redirects the browser there. Open it as a page, not through fetch.",
  middleware: [requireUserSession] as const,
  request: { params: providerParam, query: connectQuery },
  responses: {
    302: { description: "Redirects to the provider to authorize" },
    403: needsSession,
    404: notConfigured,
  },
});

const callbackRoute = createRoute({
  method: "get",
  operationId: "completeCalendarConnection",
  path: "/callback/{provider}",
  tags,
  summary: "Finish connecting a calendar",
  description:
    "The provider redirects here after authorization. Verifies the state, stores the user's token, starts writing their assigned due dates, and returns the browser to the web app.",
  middleware: [requireUserSession] as const,
  request: { params: providerParam, query: callbackQuery },
  responses: {
    302: { description: "Redirects back to the web app" },
    400: errorResponse("The state did not match this browser session"),
    403: needsSession,
    404: notConfigured,
    502: errorResponse("The provider rejected the authorization"),
  },
});

const disconnectRoute = createRoute({
  method: "delete",
  operationId: "disconnectCalendar",
  path: "/connection/{provider}",
  tags,
  summary: "Disconnect a calendar",
  description:
    "Removes the due-date events written to the calendar, then deletes the stored connection.",
  middleware: [requireUserSession] as const,
  request: { params: providerParam },
  responses: {
    200: jsonResponse("Disconnected", disconnectedSchema),
    403: needsSession,
  },
});

const listEventsRoute = createRoute({
  method: "get",
  operationId: "listCalendarEvents",
  path: "/events",
  tags,
  summary: "List calendar events",
  description:
    "Events between two instants (at most 62 days apart) from the signed-in user's connected calendars, recurring events expanded. Events written for task due dates are left out.",
  middleware: [requireUserSession] as const,
  request: { query: eventsQuery },
  responses: {
    200: jsonResponse("Calendar events", eventListSchema),
    400: errorResponse("Invalid range"),
    403: needsSession,
  },
});

const createEventRoute = createRoute({
  method: "post",
  operationId: "createCalendarEvent",
  path: "/events",
  tags,
  summary: "Create a calendar event",
  description:
    "Creates an event in one of the signed-in user's connected calendars, optionally with a new Google Meet or Microsoft Teams meeting, or with a meeting link the user supplies.",
  middleware: [requireUserSession] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createEventBody } },
    },
  },
  responses: {
    201: jsonResponse("Event created", externalEventSchema),
    400: errorResponse("Invalid event"),
    403: needsSession,
    404: notConfigured,
    409: errorResponse("The calendar is not connected or must be reconnected"),
    502: errorResponse("The provider rejected the event"),
  },
});

const syncRoute = createRoute({
  method: "post",
  operationId: "syncCalendarTasks",
  path: "/sync",
  tags,
  summary: "Sync task due dates",
  description:
    "Writes the due dates of the signed-in user's assigned tasks (from 30 days ago on) to their connected calendars, and removes events for tasks they no longer have or can no longer open.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("Tasks with a calendar event", syncedSchema),
    403: needsSession,
  },
});

const calendarSync = apiRouter()
  .openapi(statusRoute, async (c) =>
    c.json(await getStatus(c.get("userId")), 200),
  )
  .openapi(connectRoute, (c) =>
    connect(c, c.req.valid("param").provider, c.req.valid("query")),
  )
  .openapi(callbackRoute, (c) =>
    callback(c, c.req.valid("param").provider, c.req.valid("query")),
  )
  .openapi(disconnectRoute, async (c) => {
    const row = await findConnection(
      c.get("userId"),
      c.req.valid("param").provider,
    );
    if (row) await removeConnection(row);
    return c.json({ success: true }, 200);
  })
  .openapi(listEventsRoute, async (c) => {
    const { from, to } = c.req.valid("query");
    return c.json(
      await listEvents(c.get("userId"), new Date(from), new Date(to)),
      200,
    );
  })
  .openapi(createEventRoute, async (c) =>
    c.json(await createEvent(c.get("userId"), c.req.valid("json")), 201),
  )
  .openapi(syncRoute, async (c) =>
    c.json({ synced: await syncUserTasks(c.get("userId")) }, 200),
  );

export default calendarSync;
