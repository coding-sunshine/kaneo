import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { WEBHOOK_CATEGORIES } from "../admin/webhooks/categories";
import type { AuditWebhookPayload } from "../admin/webhooks/audit-webhook-payload";
import type { GitHubImportState } from "../github-integration/import-state";
import type { ImportRunProject } from "../import/import-run-project";
import type { TaskRecurrence } from "../task/recurrence/schema";

// Timestamp columns without a time zone hold UTC (Drizzle reads and writes
// them as UTC). A bare now() default would be cast through the session time
// zone, storing shifted times on servers not running in UTC.
const utcNow = sql`(now() AT TIME ZONE 'utc')`;

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const userTable = pgTable("user", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  locale: text("locale"),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { mode: "date" }),
  // Set on password sign-ups while the instance requires email verification.
  emailVerificationRequired: boolean("email_verification_required")
    .default(false)
    .notNull(),
});

export const sessionTable = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id"),
    impersonatedBy: text("impersonated_by"),
    oidcSid: text("oidc_sid"),
  },
  (table) => [
    index("session_userId_idx").on(table.userId),
    index("session_oidcSid_idx").on(table.oidcSid),
  ],
);

export const accountTable = pgTable(
  "account",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const userAvatarTable = pgTable(
  "user_avatar",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique("user_avatar_user_id_unique")
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_avatar_userId_idx").on(table.userId)],
);

// Instance administration history. Actor and target details are snapshots so
// entries stay readable after the people or records involved are deleted.
export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    actorUserId: text("actor_user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    actorName: text("actor_name"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("admin_audit_log_createdAt_idx").on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("admin_audit_log_actorUserId_idx").on(table.actorUserId),
    index("admin_audit_log_target_idx").on(table.targetType, table.targetId),
  ],
);

export const instanceWebhookTable = pgTable("instance_webhook", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  url: text("url").notNull(),
  categories: text("categories")
    .array()
    .$type<(typeof WEBHOOK_CATEGORIES)[number][]>()
    .notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  signingSecret: text("signing_secret").notNull(),
  cancelPendingBefore: timestamp("cancel_pending_before", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

export const instanceWebhookDeliveryTable = pgTable(
  "instance_webhook_delivery",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => instanceWebhookTable.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<AuditWebhookPayload>().notNull(),
    state: text("state")
      .$type<"pending" | "succeeded" | "failed">()
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    statusCode: integer("status_code"),
    errorCode: text("error_code"),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    // Use the enqueue statement's snapshot time, even inside an older action transaction.
    createdAt: timestamp("created_at", { mode: "date" })
      .default(sql`(statement_timestamp() AT TIME ZONE 'utc')`)
      .notNull(),
  },
  (table) => [
    index("instance_webhook_delivery_due_idx").on(
      table.state,
      table.nextAttemptAt,
    ),
    index("instance_webhook_delivery_history_idx").on(
      table.webhookId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

// Custom instance roles. Users hold them by name in their comma-separated
// `user.role`, next to the built-in `admin` and `user` roles.
export const instanceRoleTable = pgTable("instance_role", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull().unique(),
  permissions: text("permissions")
    .array()
    .notNull()
    .default(sql`'{}'`),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .$onUpdate(() => new Date())
    .notNull(),
});

// A single row (id "instance"). Without it, every setting has its default.
export const instanceSettingsTable = pgTable("instance_settings", {
  id: text("id").primaryKey().default("instance"),
  instanceName: text("instance_name"),
  registrationEnabled: boolean("registration_enabled").default(true).notNull(),
  passwordRegistrationEnabled: boolean("password_registration_enabled")
    .default(true)
    .notNull(),
  requireEmailVerification: boolean("require_email_verification")
    .default(false)
    .notNull(),
  defaultRoleId: text("default_role_id").references(
    () => instanceRoleTable.id,
    {
      onDelete: "restrict",
    },
  ),
  workspaceCreationRestricted: boolean("workspace_creation_restricted")
    .default(false)
    .notNull(),
  disabledIntegrations: text("disabled_integrations")
    .array()
    .notNull()
    .default(sql`'{}'`),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verificationTable = pgTable(
  "verification",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const workspaceTable = pgTable("workspace", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  // Set by an instance administrator. Archived workspaces keep their data but
  // members, API keys, integrations, and public links can no longer use them.
  archivedAt: timestamp("archived_at", { mode: "date" }),
  archivedBy: text("archived_by").references(() => userTable.id, {
    onDelete: "set null",
  }),
});

export const workspaceUserTable = pgTable(
  "workspace_member",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
      }),
    role: text("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull(),
  },
  (table) => [
    index("workspace_member_workspaceId_idx").on(table.workspaceId),
    index("workspace_member_userId_idx").on(table.userId),
  ],
);

export const workspaceBillingTable = pgTable(
  "workspace_billing",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .unique("workspace_billing_workspace_id_unique")
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    foundingFree: boolean("founding_free").notNull().default(false),
    trialEndsAt: timestamp("trial_ends_at", { mode: "date" }),
    creemCustomerId: text("creem_customer_id"),
    creemSubscriptionId: text("creem_subscription_id").unique(),
    creemProductId: text("creem_product_id"),
    plan: text("plan"),
    billingInterval: text("billing_interval"),
    status: text("status"),
    seats: integer("seats").notNull().default(1),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    canceledAt: timestamp("canceled_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("workspace_billing_workspaceId_idx").on(table.workspaceId)],
);

export const trialGrantTable = pgTable("trial_grant", {
  emailHash: text("email_hash").primaryKey(),
  trialEndsAt: timestamp("trial_ends_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

export const billingEventTable = pgTable("billing_event", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

export const teamTable = pgTable(
  "team",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    memberCount: integer("member_count").default(0).notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").$onUpdate(
      () => /* @__PURE__ */ new Date(),
    ),
  },
  (table) => [index("team_workspaceId_idx").on(table.workspaceId)],
);

export const teamMemberTable = pgTable(
  "team_member",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teamTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    membershipKey: text("membership_key").unique(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("teamMember_teamId_idx").on(table.teamId),
    index("teamMember_userId_idx").on(table.userId),
  ],
);

export const invitationTable = pgTable(
  "invitation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    teamId: text("team_id"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    projectAccess: text("project_access").default("all").notNull(),
    projectIds: text("project_ids")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
  },
  (table) => [
    index("invitation_workspaceId_idx").on(table.workspaceId),
    index("invitation_email_idx").on(table.email),
    index("invitation_inviterId_idx").on(table.inviterId),
  ],
);

export const workspaceRoleTable = pgTable(
  "workspace_role",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workspace_role_workspaceId_idx").on(table.workspaceId),
    index("workspace_role_role_idx").on(table.role),
  ],
);

export const projectTable = pgTable(
  "project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    slug: text("slug").notNull(),
    icon: text("icon").default("Layout"),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    isPublic: boolean("is_public").default(false),
    includeSubtasks: boolean("include_subtasks").notNull().default(true),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    lastTaskNumber: integer("last_task_number").notNull().default(0),
    // Closed tasks untouched this many months are archived by the scheduler; 0 turns it off.
    autoArchiveMonths: integer("auto_archive_months").notNull().default(6),
    // Linear-style cycles: team-level settings (see the `cycle` table).
    cyclesEnabled: boolean("cycles_enabled").notNull().default(false),
    cycleDurationWeeks: integer("cycle_duration_weeks").notNull().default(2),
    cycleCooldownWeeks: integer("cycle_cooldown_weeks").notNull().default(0),
    // 0 = Sunday ... 6 = Saturday (Linear's numbering, 1 = Monday).
    cycleStartDay: integer("cycle_start_day").notNull().default(1),
    cycleUpcomingCount: integer("cycle_upcoming_count").notNull().default(2),
    cycleAutoAddStarted: boolean("cycle_auto_add_started")
      .notNull()
      .default(true),
    cycleAutoAddCompleted: boolean("cycle_auto_add_completed")
      .notNull()
      .default(true),
    cycleAutoRollover: boolean("cycle_auto_rollover").notNull().default(true),
    // Linear's "Issue estimation": none, exponential, fibonacci, linear or tshirt.
    estimateType: text("estimate_type").notNull().default("none"),
    estimateExtended: boolean("estimate_extended").notNull().default(false),
    estimateAllowZero: boolean("estimate_allow_zero").notNull().default(false),
    // Insights counts an issue without an estimate as one point.
    estimateCountUnestimated: boolean("estimate_count_unestimated")
      .notNull()
      .default(true),
    position: integer("position").notNull().default(0),
    backgroundObjectKey: text("background_object_key"),
    backgroundMimeType: text("background_mime_type"),
    backgroundVersion: text("background_version"),
  },
  (table) => [
    index("project_background_object_key_idx")
      .on(table.backgroundObjectKey)
      .where(sql`${table.backgroundObjectKey} is not null`),
    unique("project_workspace_id_id_unique").on(table.workspaceId, table.id),
    index("project_workspaceId_position_idx").on(
      table.workspaceId,
      table.position,
    ),
  ],
);

// Linear team membership and subscriptions, per user. No row means a member
// of the team with no subscriptions; leaving only hides the team from the
// user's sidebar and never changes project access.
export const projectMemberPreferenceTable = pgTable(
  "project_member_preference",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    leftAt: timestamp("left_at", { mode: "date" }),
    notifyIssueAdded: boolean("notify_issue_added").default(false).notNull(),
    notifyIssueClosed: boolean("notify_issue_closed").default(false).notNull(),
    notifyIssueTriage: boolean("notify_issue_triage").default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index("project_member_preference_user_idx").on(table.userId),
  ],
);

export const workspaceMemberAccessTable = pgTable(
  "workspace_member_access",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    projectAccess: text("project_access").default("all").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("workspace_member_access_workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
    index("workspace_member_access_userId_idx").on(table.userId),
  ],
);

export const workspaceMemberProjectTable = pgTable(
  "workspace_member_project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projectTable.workspaceId, projectTable.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    unique("workspace_member_project_workspace_user_project_unique").on(
      table.workspaceId,
      table.userId,
      table.projectId,
    ),
    index("workspace_member_project_projectId_idx").on(table.projectId),
  ],
);

export const columnTable = pgTable(
  "column",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    icon: text("icon"),
    color: text("color"),
    isFinal: boolean("is_final").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("column_projectId_idx").on(table.projectId)],
);

export const workflowRuleTable = pgTable(
  "workflow_rule",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    integrationType: text("integration_type").notNull(),
    eventType: text("event_type").notNull(),
    columnId: text("column_id")
      .notNull()
      .references(() => columnTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("workflow_rule_projectId_idx").on(table.projectId),
    index("workflow_rule_columnId_idx").on(table.columnId),
  ],
);

export const calendarFeedTable = pgTable(
  "calendar_feed",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    token: text("token").notNull().unique(),
    labelIds: jsonb("label_ids").$type<string[]>().notNull(),
    timeZone: text("time_zone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [index("calendar_feed_project_id_idx").on(table.projectId)],
);

// Saved custom views: a named set of filters plus display options. A null
// `projectId` makes it a workspace view; otherwise it belongs to that team.
export const savedViewTable = pgTable(
  "saved_view",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    ownerId: text("owner_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    name: text("name").notNull(),
    description: text("description"),
    // Opaque to the API: the web app owns the filter and display shapes.
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
    display: jsonb("display").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("saved_view_workspaceId_idx").on(table.workspaceId)],
);

// Per-user sidebar favorites. `type` is "project" (a team), "view" or "document".
export const favoriteTable = pgTable(
  "favorite",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").$type<"project" | "view" | "document">().notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("favorite_user_target_unique").on(
      table.userId,
      table.type,
      table.targetId,
    ),
    index("favorite_user_workspace_idx").on(table.userId, table.workspaceId),
  ],
);

// Linear-style "Projects": a workspace-level grouping of issues across teams.
// Kaneo's own `project` table is what Linear calls a team, hence `work_project`.
export const workProjectTable = pgTable(
  "work_project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    icon: text("icon"),
    color: text("color").notNull().default("#bec2c8"),
    // backlog | planned | started | paused | completed | canceled
    status: text("status").notNull().default("backlog"),
    // Latest update health: onTrack | atRisk | offTrack; null = no updates.
    health: text("health"),
    // 0 none, 1 urgent, 2 high, 3 medium, 4 low (Linear's numbering).
    priority: integer("priority").notNull().default(0),
    leadId: text("lead_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    startDate: timestamp("start_date", { mode: "date" }),
    targetDate: timestamp("target_date", { mode: "date" }),
    summary: text("summary"),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("work_project_workspaceId_idx").on(table.workspaceId),
    unique("work_project_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

// Linear-style cycles: time-boxed iterations of a team (Kaneo `project`).
export const cycleTable = pgTable(
  "cycle",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    number: integer("number").notNull(),
    name: text("name"),
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("cycle_project_number_unique").on(table.projectId, table.number),
    index("cycle_projectId_startsAt_idx").on(table.projectId, table.startsAt),
  ],
);

export const workProjectTeamTable = pgTable(
  "work_project_team",
  {
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.workProjectId, table.projectId] }),
    index("work_project_team_projectId_idx").on(table.projectId),
  ],
);

export const workProjectMemberTable = pgTable(
  "work_project_member",
  {
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.workProjectId, table.userId] }),
    index("work_project_member_userId_idx").on(table.userId),
  ],
);

export const workProjectMilestoneTable = pgTable(
  "work_project_milestone",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    targetDate: timestamp("target_date", { mode: "date" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("work_project_milestone_projectId_idx").on(table.workProjectId),
    unique("work_project_milestone_name_unique").on(
      table.workProjectId,
      table.name,
    ),
  ],
);

export const taskTable = pgTable(
  "task",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: integer("position").default(0),
    number: integer("number").default(1),
    userId: text("assignee_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("to-do"),
    columnId: text("column_id").references(() => columnTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    priority: text("priority").default("low").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    dueDate: timestamp("due_date", { mode: "date" }),
    recurrence: jsonb("recurrence").$type<TaskRecurrence>(),
    // Linear-style archive flag: separate from status, hides the task from lists until restored.
    archivedAt: timestamp("archived_at", { mode: "date" }),
    // Linear-style triage snooze: hides the task from the triage inbox until this time.
    snoozedUntil: timestamp("snoozed_until", { mode: "date" }),
    // Linear's workflow timestamps for Insights (cycle, lead and triage time).
    // The task_stamp_status_times trigger keeps them in step with status.
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    startedTriageAt: timestamp("started_triage_at", { mode: "date" }),
    triagedAt: timestamp("triaged_at", { mode: "date" }),
    // Points on the team's estimate scale (see project.estimate_type); null is unestimated.
    estimate: integer("estimate"),
    creatorId: text("creator_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    workProjectId: text("work_project_id").references(
      () => workProjectTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    workProjectMilestoneId: text("work_project_milestone_id").references(
      () => workProjectMilestoneTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    cycleId: text("cycle_id").references(() => cycleTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    // The comment this issue was created from; Linear lists it under that comment.
    sourceCommentId: text("source_comment_id").references(
      (): AnyPgColumn => activityTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_workProjectId_idx").on(table.workProjectId),
    index("task_cycleId_idx").on(table.cycleId),
    index("task_projectId_idx").on(table.projectId),
    index("task_project_scheduled_id_idx")
      .on(table.projectId, table.id)
      .where(
        sql`${table.startDate} is not null or ${table.dueDate} is not null`,
      ),
    index("task_dueDate_idx").on(table.dueDate),
    index("task_assigneeId_idx").on(table.userId),
    index("task_columnId_idx").on(table.columnId),
    index("task_sourceCommentId_idx").on(table.sourceCommentId),
    unique("task_project_number_unique").on(table.projectId, table.number),
  ],
);

export const taskSubscriberTable = pgTable(
  "task_subscriber",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index("task_subscriber_userId_idx").on(table.userId),
  ],
);

export const billingReminderSentTable = pgTable(
  "billing_reminder_sent",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    reminderType: text("reminder_type").notNull(),
    trialEndsAt: timestamp("trial_ends_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("billing_reminder_sent_workspaceId_idx").on(table.workspaceId),
    index("billing_reminder_sent_userId_idx").on(table.userId),
    unique("billing_reminder_sent_user_type_unique").on(
      table.userId,
      table.reminderType,
    ),
  ],
);

export const jobLeaseTable = pgTable("job_lease", {
  name: text("name").primaryKey(),
  owner: text("owner").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
});

export const taskReminderSentTable = pgTable(
  "task_reminder_sent",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    reminderType: text("reminder_type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_reminder_sent_taskId_idx").on(table.taskId),
    unique("task_reminder_sent_task_type_unique").on(
      table.taskId,
      table.reminderType,
    ),
  ],
);

export const timeEntryTable = pgTable(
  "time_entry",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    description: text("description"),
    startTime: timestamp("start_time", { mode: "date" }).notNull(),
    endTime: timestamp("end_time", { mode: "date" }),
    duration: integer("duration").default(0),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("time_entry_taskId_idx").on(table.taskId),
    index("time_entry_userId_idx").on(table.userId),
  ],
);

export const activityTable = pgTable(
  "activity",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    content: text("content"),
    eventData: jsonb("event_data"),
    externalUserName: text("external_user_name"),
    externalUserAvatar: text("external_user_avatar"),
    externalSource: text("external_source"),
    externalUrl: text("external_url"),
    // Comment threads, one level deep like Linear: a reply points at a
    // top-level comment on the same task.
    parentId: text("parent_id"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    resolvedByUserId: text("resolved_by_user_id").references(
      () => userTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    // The reply shown as the thread's "Resolution"; null when resolved from
    // the root comment.
    resolvingCommentId: text("resolving_comment_id"),
  },
  (table) => [
    index("activity_task_id_idx").on(table.taskId),
    index("activity_userId_idx").on(table.userId),
    index("activity_createdAt_idx").on(table.createdAt),
    index("activity_parent_id_idx").on(table.parentId),
    unique("activity_task_external_source_external_url_unique").on(
      table.taskId,
      table.externalSource,
      table.externalUrl,
    ),
    foreignKey({
      name: "activity_parent_id_activity_id_fk",
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "activity_resolving_comment_id_activity_id_fk",
      columns: [table.resolvingCommentId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
  ],
);

export const commentReactionTable = pgTable(
  "comment_reaction",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activityTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("comment_reaction_activity_id_idx").on(table.activityId),
    unique("comment_reaction_activity_user_emoji_unique").on(
      table.activityId,
      table.userId,
      table.emoji,
    ),
  ],
);

// Per-user overrides of a thread's default subscribers (authors, mentioned
// users, assignee). Keyed by the thread's root comment.
export const commentThreadSubscriptionTable = pgTable(
  "comment_thread_subscription",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activityTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    subscribed: boolean("subscribed").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("comment_thread_subscription_activity_user_unique").on(
      table.activityId,
      table.userId,
    ),
  ],
);

// Custom emoji for reactions. The image lives in object storage like a
// project background; there is no project, so it stays out of `asset`.
export const workspaceEmojiTable = pgTable(
  "workspace_emoji",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    objectKey: text("object_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    version: text("version").notNull(),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("workspace_emoji_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

export const assetTable = pgTable(
  "asset",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    activityId: text("activity_id").references(() => activityTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    kind: text("kind").notNull().default("image"),
    surface: text("surface").notNull().default("description"),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("asset_workspaceId_idx").on(table.workspaceId),
    index("asset_projectId_idx").on(table.projectId),
    index("asset_taskId_idx").on(table.taskId),
    index("asset_activityId_idx").on(table.activityId),
    index("asset_createdBy_idx").on(table.createdBy),
    index("asset_draft_expiry_idx")
      .on(table.createdAt, table.id)
      .where(
        sql`${table.taskId} is null and ${table.surface} in ('draft', 'draft-pending')`,
      ),
  ],
);

export const labelTable = pgTable(
  "label",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
    deletionStartedAt: timestamp("deletion_started_at", { mode: "date" }),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    workspaceId: text("workspace_id").references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    index("label_task_id_idx").on(table.taskId),
    index("label_workspace_id_idx").on(table.workspaceId),
    index("label_workspace_cascade_idx")
      .on(table.workspaceId, table.name, table.createdAt, table.id)
      .where(sql`${table.taskId} is not null`),
    unique("label_task_name_unique").on(table.taskId, table.name),
    uniqueIndex("label_workspace_name_unique")
      .on(table.workspaceId, table.name)
      .where(sql`${table.taskId} is null`),
  ],
);

export const notificationTable = pgTable(
  "notification",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    title: text("title"),
    content: text("content"),
    type: text("type").notNull().default("info"),
    eventData: jsonb("event_data"),
    isRead: boolean("is_read").default(false),
    snoozedUntil: timestamp("snoozed_until", {
      mode: "date",
      withTimezone: true,
    }),
    resourceId: text("resource_id"),
    resourceType: text("resource_type"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("notification_userId_idx").on(table.userId)],
);

export const userNotificationPreferenceTable = pgTable(
  "user_notification_preference",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    emailEnabled: boolean("email_enabled").default(false).notNull(),
    ntfyEnabled: boolean("ntfy_enabled").default(false).notNull(),
    ntfyServerUrl: text("ntfy_server_url"),
    ntfyTopic: text("ntfy_topic"),
    ntfyToken: text("ntfy_token"),
    gotifyEnabled: boolean("gotify_enabled").default(false).notNull(),
    gotifyServerUrl: text("gotify_server_url"),
    gotifyToken: text("gotify_token"),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    taskAssignmentEnabled: boolean("task_assignment_enabled")
      .default(true)
      .notNull(),
    taskCommentEnabled: boolean("task_comment_enabled").default(true).notNull(),
    taskStatusChangeEnabled: boolean("task_status_change_enabled")
      .default(true)
      .notNull(),
    dueDateReminderEnabled: boolean("due_date_reminder_enabled")
      .default(true)
      .notNull(),
    dueDateReminderLeadTimeMinutes: integer(
      "due_date_reminder_lead_time_minutes",
    )
      .default(1440)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
);

export const userNotificationWorkspaceRuleTable = pgTable(
  "user_notification_workspace_rule",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    isActive: boolean("is_active").default(true).notNull(),
    emailEnabled: boolean("email_enabled").default(false).notNull(),
    ntfyEnabled: boolean("ntfy_enabled").default(false).notNull(),
    gotifyEnabled: boolean("gotify_enabled").default(false).notNull(),
    webhookEnabled: boolean("webhook_enabled").default(false).notNull(),
    projectMode: text("project_mode").default("all").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("user_notification_workspace_rule_userId_idx").on(table.userId),
    index("user_notification_workspace_rule_workspaceId_idx").on(
      table.workspaceId,
    ),
    unique("user_notification_workspace_rule_user_workspace_unique").on(
      table.userId,
      table.workspaceId,
    ),
    unique("user_notification_workspace_rule_workspace_id_id_unique").on(
      table.workspaceId,
      table.id,
    ),
  ],
);

export const userNotificationWorkspaceProjectTable = pgTable(
  "user_notification_workspace_project",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceRuleId: text("workspace_rule_id").notNull(),
    projectId: text("project_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.workspaceRuleId],
      foreignColumns: [
        userNotificationWorkspaceRuleTable.workspaceId,
        userNotificationWorkspaceRuleTable.id,
      ],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projectTable.workspaceId, projectTable.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("user_notification_workspace_project_ruleId_idx").on(
      table.workspaceRuleId,
    ),
    index("user_notification_workspace_project_projectId_idx").on(
      table.projectId,
    ),
    index("user_notification_workspace_project_workspaceId_projectId_idx").on(
      table.workspaceId,
      table.projectId,
    ),
    index("unwp_workspaceId_workspaceRuleId_idx").on(
      table.workspaceId,
      table.workspaceRuleId,
    ),
    unique("user_notification_workspace_project_rule_project_unique").on(
      table.workspaceRuleId,
      table.projectId,
    ),
  ],
);

// Legacy table: the GitHub plugin migration drops it at startup on existing
// installs, so SQL migrations must not touch it.
export const githubIntegrationTable = pgTable("github_integration", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .unique(),
  repositoryOwner: text("repository_owner").notNull(),
  repositoryName: text("repository_name").notNull(),
  installationId: integer("installation_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const integrationTable = pgTable(
  "integration",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    config: text("config").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("integration_projectId_idx").on(table.projectId),
    index("integration_type_idx").on(table.type),
    unique("integration_project_type_unique").on(table.projectId, table.type),
  ],
);

export const githubImportTable = pgTable("github_import", {
  integrationId: text("integration_id")
    .primaryKey()
    .references(() => integrationTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  runId: text("run_id")
    .notNull()
    .$defaultFn(() => createId()),
  state: jsonb("state").$type<GitHubImportState>().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .notNull()
    .$onUpdate(() => new Date()),
});

export const importRunTable = pgTable(
  "import_run",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    source: text("source").notNull(),
    status: text("status").notNull().default("running"),
    includeComments: boolean("include_comments").notNull().default(true),
    message: text("message"),
    projects: jsonb("projects").$type<ImportRunProject[]>().notNull(),
    error: text("error"),
    heartbeatAt: timestamp("heartbeat_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    finishedAt: timestamp("finished_at", { mode: "date" }),
  },
  (table) => [
    index("import_run_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const externalLinkTable = pgTable(
  "external_link",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    integrationId: text("integration_id").references(
      () => integrationTable.id,
      {
        onDelete: "cascade",
        onUpdate: "cascade",
      },
    ),
    resourceType: text("resource_type").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("external_link_taskId_idx").on(table.taskId),
    index("external_link_integrationId_idx").on(table.integrationId),
    index("external_link_externalId_idx").on(table.externalId),
    index("external_link_resourceType_idx").on(table.resourceType),
    index("external_link_deferred_issue_idx")
      .on(table.id)
      .where(
        sql`${table.resourceType} = 'issue' AND ${table.metadata} LIKE '%"deferredIssueEdit":%'`,
      ),
  ],
);

export const commentTable = pgTable(
  "comment",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("comment_task_idx").on(table.taskId),
    index("comment_user_idx").on(table.userId),
  ],
);

export const taskRelationTable = pgTable(
  "task_relation",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    sourceTaskId: text("source_task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    targetTaskId: text("target_task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    relationType: text("relation_type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("task_relation_source_idx").on(table.sourceTaskId),
    index("task_relation_target_idx").on(table.targetTaskId),
  ],
);

export const apikeyTable = pgTable(
  "apikey",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: text("reference_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    prefix: text("prefix"),
    key: text("key").notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "cascade",
    }),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { mode: "date" }),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_configId_idx").on(table.configId),
    index("apikey_key_idx").on(table.key),
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_userId_idx").on(table.userId),
  ],
);

export const deviceCodeTable = pgTable(
  "device_code",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    deviceCode: text("device_code").notNull(),
    userCode: text("user_code").notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    status: text("status").notNull(),
    lastPolledAt: timestamp("last_polled_at", { mode: "date" }),
    pollingInterval: integer("polling_interval"),
    clientId: text("client_id"),
    scope: text("scope"),
  },
  (table) => [
    uniqueIndex("device_code_device_code_uidx").on(table.deviceCode),
    uniqueIndex("device_code_user_code_uidx").on(table.userCode),
    index("device_code_user_id_idx").on(table.userId),
  ],
);

export const mcpOauthStateTable = pgTable(
  "mcp_oauth_state",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    payload: jsonb("payload").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("mcp_oauth_state_kind_key_uidx").on(table.kind, table.key),
    index("mcp_oauth_state_expiresAt_idx").on(table.expiresAt),
  ],
);

// Auth-schema compatible aliases in schema.ts
export const user = userTable;
export const session = sessionTable;
export const account = accountTable;
export const verification = verificationTable;
export const workspace = workspaceTable;
export const team = teamTable;
export const teamMember = teamMemberTable;
export const workspace_member = workspaceUserTable;
export const invitation = invitationTable;
export const organizationRole = workspaceRoleTable;
export const apikey = apikeyTable;
export const deviceCode = deviceCodeTable;

// Auth-schema compatible relation exports in schema.ts
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  teamMembers: many(teamMember),
  workspace_members: many(workspace_member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const workspaceRelations = relations(workspace, ({ many }) => ({
  teams: many(team),
  workspace_members: many(workspace_member),
  invitations: many(invitation),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [team.workspaceId],
    references: [workspace.id],
  }),
  teamMembers: many(teamMember),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, {
    fields: [teamMember.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [teamMember.userId],
    references: [user.id],
  }),
}));

export const workspace_memberRelations = relations(
  workspace_member,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [workspace_member.workspaceId],
      references: [workspace.id],
    }),
    user: one(user, {
      fields: [workspace_member.userId],
      references: [user.id],
    }),
  }),
);

export const invitationRelations = relations(invitation, ({ one }) => ({
  workspace: one(workspace, {
    fields: [invitation.workspaceId],
    references: [workspace.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const organizationRoleRelations = relations(
  organizationRole,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [organizationRole.workspaceId],
      references: [workspace.id],
    }),
  }),
);

export const customFieldDefinitionTable = pgTable(
  "custom_field_definition",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projectTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'text' | 'number' | 'date' | 'dropdown' | 'boolean'
    required: boolean("required").default(false).notNull(),
    defaultValue: text("default_value"),
    options: jsonb("options"),
    // Options kept for tasks that already use them but no longer offered.
    hiddenOptions: jsonb("hidden_options")
      .$type<string[]>()
      .default([])
      .notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("custom_field_def_projectId_idx").on(table.projectId)],
);

export const customFieldValueTable = pgTable(
  "custom_field_value",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    fieldId: text("field_id")
      .notNull()
      .references(() => customFieldDefinitionTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    value: text("value"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("custom_field_value_taskId_idx").on(table.taskId),
    index("custom_field_value_fieldId_idx").on(table.fieldId),
    unique("custom_field_value_task_field_unique").on(
      table.taskId,
      table.fieldId,
    ),
  ],
);

// These records outlive their original owner so failed object deletion can retry.
export const storageCleanupTable = pgTable("storage_cleanup", {
  objectKey: text("object_key").primaryKey(),
  lastAttemptAt: timestamp("last_attempt_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

export const dataMigrationTable = pgTable("data_migration", {
  id: text("id").primaryKey(),
  completedAt: timestamp("completed_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

// Linear-style documents. A document lives in one place: the creator's private
// documents, the whole workspace, a team, a work project or an issue.
export const DOCUMENT_SCOPES = [
  "private",
  "workspace",
  "team",
  "project",
  "issue",
] as const;
export type DocumentScope = (typeof DOCUMENT_SCOPES)[number];
export const DOCUMENT_ACCESS = ["edit", "comment", "view"] as const;
export type DocumentAccess = (typeof DOCUMENT_ACCESS)[number];

export const documentTable = pgTable(
  "document",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    title: text("title").notNull().default(""),
    icon: text("icon"),
    color: text("color"),
    content: text("content").notNull().default(""),
    scope: text("scope").$type<DocumentScope>().notNull().default("private"),
    // Team (Kaneo project) for scope "team".
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    workProjectId: text("work_project_id").references(
      () => workProjectTable.id,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    // What everyone who can see the parent (or the workspace) may do.
    generalAccess: text("general_access")
      .$type<DocumentAccess>()
      .notNull()
      .default("edit"),
    creatorId: text("creator_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    updatedById: text("updated_by_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("document_workspace_idx").on(table.workspaceId),
    index("document_project_idx").on(table.projectId),
    index("document_work_project_idx").on(table.workProjectId),
    index("document_task_idx").on(table.taskId),
    index("document_creator_idx").on(table.creatorId),
    uniqueIndex("document_external_unique").on(
      table.workspaceId,
      table.externalSource,
      table.externalId,
    ),
    check(
      "document_scope_parent",
      sql`CASE ${table.scope}
        WHEN 'team' THEN ${table.projectId} IS NOT NULL AND num_nonnulls(${table.workProjectId}, ${table.taskId}) = 0
        WHEN 'project' THEN ${table.workProjectId} IS NOT NULL AND num_nonnulls(${table.projectId}, ${table.taskId}) = 0
        WHEN 'issue' THEN ${table.taskId} IS NOT NULL AND num_nonnulls(${table.projectId}, ${table.workProjectId}) = 0
        WHEN 'private' THEN num_nonnulls(${table.projectId}, ${table.workProjectId}, ${table.taskId}) = 0
        WHEN 'workspace' THEN num_nonnulls(${table.projectId}, ${table.workProjectId}, ${table.taskId}) = 0
        ELSE false END`,
    ),
  ],
);

// People invited directly through Share.
export const documentShareTable = pgTable(
  "document_share",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    access: text("access").$type<DocumentAccess>().notNull().default("edit"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.userId] }),
    index("document_share_user_idx").on(table.userId),
  ],
);

export const documentSubscriberTable = pgTable(
  "document_subscriber",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.userId] }),
    index("document_subscriber_user_idx").on(table.userId),
  ],
);

// Version history. An author's edits within a few minutes fold into one row.
export const documentVersionTable = pgTable(
  "document_version",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    authorId: text("author_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("document_version_document_idx").on(
      table.documentId,
      table.createdAt,
    ),
  ],
);

export const documentCommentTable = pgTable(
  "document_comment",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    parentId: text("parent_id").references(
      (): AnyPgColumn => documentCommentTable.id,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
    content: text("content").notNull(),
    // The document text an inline comment was left on.
    quotedText: text("quoted_text"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    resolvedById: text("resolved_by_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("document_comment_document_idx").on(table.documentId),
    uniqueIndex("document_comment_external_unique").on(
      table.documentId,
      table.externalSource,
      table.externalId,
    ),
  ],
);
