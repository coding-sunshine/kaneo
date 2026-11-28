import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  customType,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bodyVector, titleBodyVector } from "../search/fts";
import type { ChatMessage } from "../agent/openrouter";
import type { WEBHOOK_CATEGORIES } from "../admin/webhooks/categories";
import type { AuditWebhookPayload } from "../admin/webhooks/audit-webhook-payload";
import type { GitHubImportState } from "../github-integration/import-state";
import type { ImportRunProject } from "../import/import-run-project";
import type { TaskRecurrence } from "../task/recurrence/schema";
import type { LinkPreview } from "../chat/link-preview/link-preview-type";

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
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
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
    // Set on an assistant token the person limited to documents. Null means
    // the session may do everything its person may.
    mcpScope: text("mcp_scope"),
    // Set when the instance requires two-factor and this password user had
    // none at sign-in. Such a session can only set two-factor up.
    twoFactorSetupRequired: boolean("two_factor_setup_required")
      .default(false)
      .notNull(),
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

// Linear's workspace webhooks (Settings > API > Webhooks): data-change events for one workspace.
export const workspaceWebhookTable = pgTable(
  "workspace_webhook",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    // Encrypted with NOTIFICATION_SECRET_ENCRYPTION_KEY; the plain value is shown once on create.
    secret: text("secret").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    resourceTypes: text("resource_types").array().notNull(),
    // Empty = every team (project) in the workspace.
    projectIds: text("project_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [index("workspace_webhook_workspace_idx").on(table.workspaceId)],
);

export const workspaceWebhookDeliveryTable = pgTable(
  "workspace_webhook_delivery",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => workspaceWebhookTable.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
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
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("workspace_webhook_delivery_due_idx").on(
      table.state,
      table.nextAttemptAt,
    ),
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
  requireTwoFactor: boolean("require_two_factor").default(false).notNull(),
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
    // The newest change on a followed topic that the Documents page has shown
    // this member. Anything later is "new since your last visit".
    documentsSeenAt: timestamp("documents_seen_at", { mode: "date" }),
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
    // A guest invitation: the person joins with selected project access, the
    // guest limits, and the chat channels in `channelIds`.
    guest: boolean("guest").default(false).notNull(),
    channelIds: text("channel_ids")
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
    // Open only to people with a row in workspace_member_project, the workspace
    // owner and instance administrators, whatever the person's own access mode.
    isPrivate: boolean("is_private").notNull().default(false),
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
    // Linear SLAs: urgent and high issues get a deadline this many hours after the priority is set.
    slaEnabled: boolean("sla_enabled").notNull().default(false),
    slaUrgentHours: integer("sla_urgent_hours").notNull().default(24),
    slaHighHours: integer("sla_high_hours").notNull().default(168),
    // Linear triage responsibility: "notify" or "assign" (rotating) for the people listed in
    // project_triage_responsible.
    triageResponsibilityMode: text("triage_responsibility_mode")
      .notNull()
      .default("notify"),
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

// People responsible for a team's triage queue; lastAssignedAt drives the rotation.
export const projectTriageResponsibleTable = pgTable(
  "project_triage_responsible",
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
    lastAssignedAt: timestamp("last_assigned_at", { mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

// A team's email intake: mail to <mailbox>+<token>@<domain> becomes a Triage
// ticket. No row means intake is off for the team.
export const emailIntakeTable = pgTable("email_intake", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // 128 random bits as hex. Mail is matched by token_hash (SHA-256 of the
  // token) and confirmed with a constant-time compare of the token.
  token: text("token").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

// Every message of a ticket's email thread, received or sent, so replies find
// their ticket by In-Reply-To and References and the same mail is never filed twice.
export const emailIntakeMessageTable = pgTable(
  "email_intake_message",
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
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    messageId: text("message_id").notNull(),
    // "inbound" from the requester or "outbound" from the team.
    direction: text("direction").notNull(),
    // An outbound reply is "pending" while it is being sent, then "sent".
    status: text("status").notNull().default("sent"),
    // The requester's address and name, whichever way the message went.
    address: text("address").notNull(),
    name: text("name"),
    subject: text("subject").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("email_intake_message_project_message_unique").on(
      table.projectId,
      table.messageId,
    ),
    index("email_intake_message_task_idx").on(table.taskId),
  ],
);

// Intake mail that kept failing to file, by mailbox UID. After five failed
// attempts the poller stops reading it; the message stays in the mailbox.
export const emailIntakeFailureTable = pgTable("email_intake_failure", {
  uid: text("uid").primaryKey(),
  attempts: integer("attempts").notNull().default(1),
  lastFailedAt: timestamp("last_failed_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

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
    // An outside person: always "selected" access, only the channels they were
    // added to, and no directory or workspace-wide documents. See guest/.
    guest: boolean("guest").default(false).notNull(),
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

// A person's own Google or Microsoft calendar, connected for two-way sync.
// Separate from `account` so the sign-in providers never see these rows.
export const calendarConnectionTable = pgTable(
  "calendar_connection",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    provider: text("provider").$type<"google" | "microsoft">().notNull(),
    accountEmail: text("account_email"),
    // Null once the provider rejects the token: the page offers "Reconnect".
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
    }),
    // Task due dates are stored as instants; this picks the calendar day.
    timeZone: text("time_zone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("calendar_connection_user_provider_unique").on(
      table.userId,
      table.provider,
    ),
  ],
);

// The event a task's due date was written to in a connected calendar. No
// foreign key on the task: the row must outlive it so the event can be removed.
export const calendarTaskEventTable = pgTable(
  "calendar_task_event",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => calendarConnectionTable.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    externalEventId: text("external_event_id").notNull(),
    // What was last written, so an unrelated task change sends nothing.
    fingerprint: text("fingerprint").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("calendar_task_event_connection_task_unique").on(
      table.connectionId,
      table.taskId,
    ),
    index("calendar_task_event_task_id_idx").on(table.taskId),
  ],
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
    // "personal" views are visible to their owner only; "shared" ones to the
    // team (or workspace, when `projectId` is null).
    visibility: text("visibility")
      .$type<"personal" | "shared">()
      .notNull()
      .default("shared"),
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

// Per-user sidebar favorites. `type` is "project" (a team), "view", "document" or
// "pullRequest" (targetId owner/repo#number).
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
    type: text("type")
      .$type<"project" | "view" | "document" | "pullRequest" | "documentPin">()
      .notNull(),
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

// Per-user unfinished create-issue forms ("Drafts"). Private to the author.
// `properties` is opaque to the API: the web create form owns its shape.
export const taskDraftTable = pgTable(
  "task_draft",
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
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    properties: jsonb("properties")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("task_draft_user_workspace_idx").on(table.userId, table.workspaceId),
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
    // Team summary, snapshotted when the cycle completes; null before then.
    summaryCompleted: integer("summary_completed"),
    summaryAddedAfterStart: integer("summary_added_after_start"),
    summaryCarriedOver: integer("summary_carried_over"),
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

// Linear project labels: workspace-scoped, attached to projects (work_project).
export const projectLabelTable = pgTable(
  "project_label",
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
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("project_label_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

export const workProjectLabelTable = pgTable(
  "work_project_label",
  {
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => projectLabelTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.workProjectId, table.labelId] }),
    index("work_project_label_labelId_idx").on(table.labelId),
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

export const workProjectUpdateTable = pgTable(
  "work_project_update",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    // onTrack | atRisk | offTrack
    health: text("health").notNull(),
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("work_project_update_projectId_idx").on(
      table.workProjectId,
      table.createdAt,
    ),
  ],
);

// Linear-style comments on a project's activity feed (separate from health updates).
export const workProjectCommentTable = pgTable(
  "work_project_comment",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("work_project_comment_projectId_idx").on(
      table.workProjectId,
      table.createdAt,
    ),
  ],
);

// Linear's project resources: a link to a web page, or to a path inside the app.
export const workProjectLinkTable = pgTable(
  "work_project_link",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    label: text("label").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("work_project_link_projectId_idx").on(
      table.workProjectId,
      table.sortOrder,
    ),
  ],
);

// A project waits on another: `workProjectId` cannot finish before `dependsOnId`.
export const workProjectDependencyTable = pgTable(
  "work_project_dependency",
  {
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    dependsOnId: text("depends_on_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workProjectId, table.dependsOnId] }),
    index("work_project_dependency_dependsOnId_idx").on(table.dependsOnId),
    check(
      "work_project_dependency_not_self",
      sql`${table.workProjectId} <> ${table.dependsOnId}`,
    ),
  ],
);

// Linear-style initiatives: a workspace-level goal one level above projects.
export const initiativeTable = pgTable(
  "initiative",
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
    description: text("description"),
    ownerId: text("owner_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    targetDate: timestamp("target_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("initiative_workspaceId_idx").on(table.workspaceId)],
);

export const initiativeWorkProjectTable = pgTable(
  "initiative_work_project",
  {
    initiativeId: text("initiative_id")
      .notNull()
      .references(() => initiativeTable.id, { onDelete: "cascade" }),
    workProjectId: text("work_project_id")
      .notNull()
      .references(() => workProjectTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.initiativeId, table.workProjectId] }),
    index("initiative_work_project_workProjectId_idx").on(table.workProjectId),
  ],
);

export const initiativeUpdateTable = pgTable(
  "initiative_update",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    initiativeId: text("initiative_id")
      .notNull()
      .references(() => initiativeTable.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    // onTrack | atRisk | offTrack
    health: text("health").notNull(),
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("initiative_update_initiativeId_idx").on(
      table.initiativeId,
      table.createdAt,
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
    canceledAt: timestamp("canceled_at", { mode: "date" }),
    startedTriageAt: timestamp("started_triage_at", { mode: "date" }),
    triagedAt: timestamp("triaged_at", { mode: "date" }),
    // Linear SLA deadline, set from the team's SLA rules when the priority is set.
    slaDueAt: timestamp("sla_due_at", { mode: "date" }),
    // Set when the warning / breach notification for the current sla_due_at went out; cleared when it changes.
    slaWarningNotifiedAt: timestamp("sla_warning_notified_at", {
      mode: "date",
    }),
    slaBreachedAt: timestamp("sla_breached_at", { mode: "date" }),
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
    // When the issue joined its cycle; the cycle summary counts later joins.
    cycleAddedAt: timestamp("cycle_added_at", { mode: "date" }),
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
    index("task_search_idx").using(
      "gin",
      titleBodyVector(table.title, table.description),
    ),
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

export const DESIGN_REVIEW_STATUSES = ["pending", "approved"] as const;

// One row per reviewer on a task. Asking again resets it to pending.
export const taskDesignReviewTable = pgTable(
  "task_design_review",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    requesterId: text("requester_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: text("status", { enum: DESIGN_REVIEW_STATUSES })
      .default("pending")
      .notNull(),
    requestedAt: timestamp("requested_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.reviewerId] }),
    index("task_design_review_reviewer_status_idx").on(
      table.reviewerId,
      table.status,
    ),
  ],
);

// Figma link cards, stored per workspace so a page of comments never fans out
// to Figma and everyone sees the same fetched-at time until someone refreshes.
export const figmaLinkPreviewTable = pgTable(
  "figma_link_preview",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaceTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    fileKey: text("file_key").notNull(),
    // Empty when the link points at the whole file rather than a frame.
    nodeId: text("node_id").default("").notNull(),
    url: text("url").notNull(),
    fileName: text("file_name").notNull(),
    frameName: text("frame_name"),
    thumbnailUrl: text("thumbnail_url"),
    fetchedAt: timestamp("fetched_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.fileKey, table.nodeId] }),
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
    index("activity_search_idx").using("gin", bodyVector(table.content)),
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
    // The team of an issue's file. Null on a document's file.
    projectId: text("project_id").references(() => projectTable.id, {
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
    // The document a file was uploaded into. Such a file has no team, issue
    // or comment: who may read it is who may open the document, wherever the
    // document moves. Its row goes by cascade with the document, and the
    // `asset_storage_cleanup` trigger queues the stored object.
    documentId: text("document_id").references(
      (): AnyPgColumn => documentTable.id,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
    // The team chat message a file was sent with. Who may read it is who may
    // read the message's channel; the row goes by cascade with the message.
    chatMessageId: text("chat_message_id").references(
      (): AnyPgColumn => chatMessageTable.id,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
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
    index("asset_documentId_idx").on(table.documentId),
    index("asset_chatMessageId_idx").on(table.chatMessageId),
    index("asset_draft_expiry_idx")
      .on(table.createdAt, table.id)
      .where(
        sql`${table.taskId} is null and ${table.surface} in ('draft', 'draft-pending')`,
      ),
    check(
      "asset_one_owner",
      sql`num_nonnulls(${table.projectId}, ${table.documentId}, ${table.chatMessageId}) = 1`,
    ),
    check(
      "asset_document_file_unattached",
      sql`${table.documentId} IS NULL OR num_nonnulls(${table.taskId}, ${table.activityId}) = 0`,
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
    // Team (project) scope: null means a workspace label.
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    // Label group: the parent is a template label; one child per task.
    parentLabelId: text("parent_label_id").references(
      (): AnyPgColumn => labelTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
  },
  (table) => [
    index("label_task_id_idx").on(table.taskId),
    index("label_project_id_idx").on(table.projectId),
    index("label_parent_label_id_idx").on(table.parentLabelId),
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
    topicUpdatesEnabled: boolean("topic_updates_enabled")
      .default(true)
      .notNull(),
    scheduleEnabled: boolean("schedule_enabled").default(false).notNull(),
    scheduleTimezone: text("schedule_timezone").default("UTC").notNull(),
    // Delivery window: weekdays 0 (Sunday) to 6, local "HH:MM" start and end.
    scheduleDays: integer("schedule_days")
      .array()
      .default(sql`'{1,2,3,4,5}'::integer[]`)
      .notNull(),
    scheduleStart: text("schedule_start").default("09:00").notNull(),
    scheduleEnd: text("schedule_end").default("18:00").notNull(),
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

export const pullRequestOwnerTable = pgTable(
  "pull_request_owner",
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
    url: text("url").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => userTable.id, {
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
    unique("pull_request_owner_workspace_url_unique").on(
      table.workspaceId,
      table.url,
    ),
    index("pull_request_owner_ownerUserId_idx").on(table.ownerUserId),
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

export const passkeyTable = pgTable(
  "passkey",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", { mode: "date" }).default(utcNow),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    uniqueIndex("passkey_credentialID_idx").on(table.credentialID),
  ],
);

export const twoFactorTable = pgTable(
  "two_factor",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until", { mode: "date" }),
  },
  (table) => [
    index("two_factor_userId_idx").on(table.userId),
    index("two_factor_secret_idx").on(table.secret),
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
export const passkey = passkeyTable;

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

// Linear-style issue templates of a team (Kaneo project): defaults that prefill
// the create-issue dialog. Labels are stored as name and color because task
// labels are per-task copies.
export const issueTemplateTable = pgTable(
  "issue_template",
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
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    columnId: text("column_id").references(() => columnTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    priority: text("priority").notNull().default("no-priority"),
    assigneeId: text("assignee_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    labels: jsonb("labels")
      .$type<{ name: string; color: string }[]>()
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
  (table) => [index("issue_template_projectId_idx").on(table.projectId)],
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
export const DOCUMENT_KINDS = [
  "unsorted",
  "decision",
  "proposal",
  "brainstorm",
  "reference",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_STATUSES = [
  "draft",
  "in_review",
  "current",
  "superseded",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export const DOCUMENT_SOURCE_CLIENTS = ["claude", "chatgpt", "web"] as const;
export type DocumentSourceClient = (typeof DOCUMENT_SOURCE_CLIENTS)[number];

// A topic is one question the team keeps one current answer to, such as
// "Launch plan". It lives in a place, like a document, and whoever can open
// the place can open the topic.
export const TOPIC_SCOPES = ["workspace", "team", "project"] as const;
export type TopicScope = (typeof TOPIC_SCOPES)[number];

export const topicTable = pgTable(
  "topic",
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
    scope: text("scope").$type<TopicScope>().notNull().default("workspace"),
    // Team (Kaneo project) for scope "team".
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    workProjectId: text("work_project_id").references(
      () => workProjectTable.id,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
    // Who makes a document current on this topic, and who stands in for them.
    deciderId: text("decider_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    backupDeciderId: text("backup_decider_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    creatorId: text("creator_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("topic_workspace_idx").on(table.workspaceId),
    check(
      "topic_scope_parent",
      sql`CASE ${table.scope}
        WHEN 'team' THEN ${table.projectId} IS NOT NULL AND ${table.workProjectId} IS NULL
        WHEN 'project' THEN ${table.workProjectId} IS NOT NULL AND ${table.projectId} IS NULL
        WHEN 'workspace' THEN num_nonnulls(${table.projectId}, ${table.workProjectId}) = 0
        ELSE false END`,
    ),
  ],
);

// People who follow a topic. Nothing reads this table yet.
export const topicSubscriberTable = pgTable(
  "topic_subscriber",
  {
    topicId: text("topic_id")
      .notNull()
      .references(() => topicTable.id, {
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
    primaryKey({ columns: [table.topicId, table.userId] }),
    index("topic_subscriber_user_idx").on(table.userId),
  ],
);

// The topics an issue is about. Nothing reads this table yet.
export const taskTopicTable = pgTable(
  "task_topic",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topicTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.topicId] }),
    index("task_topic_topic_idx").on(table.topicId),
  ],
);

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
    kind: text("kind").$type<DocumentKind>().notNull().default("unsorted"),
    status: text("status").$type<DocumentStatus>().notNull().default("draft"),
    // SHA-256 of `content` in UTF-8, as hex. The `document_content_hash`
    // trigger writes it, so that imports that insert rows by SQL get it too.
    contentHash: text("content_hash"),
    // Hashed runs of five words of the text (see `document/fingerprint.ts`),
    // to find the document a new text is a revision of. Written by the API.
    // Null on a row whose text was written by SQL since: a database trigger
    // clears it, and the next comparison fills it in.
    fingerprint: integer("fingerprint").array(),
    // The assistant a document was saved from, when it was not typed here.
    sourceClient: text("source_client").$type<DocumentSourceClient>(),
    // The page this one sits under in the page tree. Each page keeps its own
    // place and access: a reader who cannot open the parent sees the child at
    // the top of the tree. No foreign key: an existing table gets none, so
    // code that deletes documents for good clears this on the pages under
    // them (`document/release-child-pages.ts`).
    parentDocumentId: text("parent_document_id"),
    // The topic the document is filed on. A filed document lives in the
    // topic's place.
    topicId: text("topic_id").references(() => topicTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    filedAt: timestamp("filed_at", { mode: "date" }),
    // Who filed it on the topic, who need not be its author. Null on a
    // document filed before this was recorded: its author stands in. No
    // foreign key: an existing table gets none. A filer whose account is
    // gone keeps their id here, which still reads as somebody else.
    filedById: text("filed_by_id"),
    // Set aside in the Inbox until this time. One date for everybody who sees
    // the item: one person triages the Inbox.
    inboxSnoozedUntil: timestamp("inbox_snoozed_until", { mode: "date" }),
    // When the document last came into the Inbox: written in a shared place,
    // or moved there from My documents or off a topic. Rows from before this
    // column count from the migration.
    inboxSince: timestamp("inbox_since", { mode: "date" })
      .default(utcNow)
      .notNull(),
    // When its people were reminded that it still waits there. Once per stay:
    // a reminder older than `inboxSince` belongs to an earlier one.
    inboxRemindedAt: timestamp("inbox_reminded_at", { mode: "date" }),
    // Why the document has the status it has: the reason given on approval.
    statusReason: text("status_reason"),
    // The approval that made the document current: who, when, and the text.
    // `approvedHash` is the `contentHash` of that moment, and the version row
    // keeps the text itself.
    approvedBy: text("approved_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    approvedAt: timestamp("approved_at", { mode: "date" }),
    approvedHash: text("approved_hash"),
    approvedVersionId: text("approved_version_id").references(
      (): AnyPgColumn => documentVersionTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    // The document that was current on the topic before this one. On a
    // proposal: the current document its author means it to replace.
    supersedesDocumentId: text("supersedes_document_id").references(
      (): AnyPgColumn => documentTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    // The last time a decider said the document is still current.
    confirmedAt: timestamp("confirmed_at", { mode: "date" }),
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
    index("document_search_idx").using(
      "gin",
      titleBodyVector(table.title, table.content),
    ),
    index("document_project_idx").on(table.projectId),
    index("document_work_project_idx").on(table.workProjectId),
    index("document_task_idx").on(table.taskId),
    index("document_creator_idx").on(table.creatorId),
    index("document_topic_idx").on(table.topicId),
    index("document_parent_document_idx").on(table.parentDocumentId),
    // One current document per topic, whatever the code does.
    uniqueIndex("one_current")
      .on(table.topicId)
      .where(sql`${table.status} = 'current' AND ${table.deletedAt} IS NULL`),
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
    // A document only its author can open is not the team's current answer.
    check(
      "document_current_not_private",
      sql`NOT (${table.status} = 'current' AND ${table.scope} = 'private')`,
    ),
  ],
);

// Where a document's file came from. One row per file.
export const documentFileTable = pgTable(
  "document_file",
  {
    assetId: text("asset_id")
      .primaryKey()
      .references(() => assetTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // The name the file had on the uploader's side, before it was made safe
    // for storage.
    originalName: text("original_name").notNull(),
    sourceClient: text("source_client").$type<DocumentSourceClient>(),
    sourceUserId: text("source_user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [index("document_file_document_idx").on(table.documentId)],
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

export const DOCUMENT_LINEAGE_STATUSES = [
  "proposed",
  "confirmed",
  "dismissed",
] as const;
export type DocumentLineageStatus = (typeof DOCUMENT_LINEAGE_STATUSES)[number];

// "Looks like a revision of": the older document a text resembles. The API
// proposes it and a person confirms or dismisses it. It is a hint beside the
// document and never changes a status.
export const documentLineageTable = pgTable(
  "document_lineage",
  {
    documentId: text("document_id")
      .primaryKey()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sourceDocumentId: text("source_document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // The share of five-word runs the two texts had in common, in percent.
    overlap: integer("overlap").notNull(),
    status: text("status")
      .$type<DocumentLineageStatus>()
      .notNull()
      .default("proposed"),
    decidedBy: text("decided_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    decidedAt: timestamp("decided_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [index("document_lineage_source_idx").on(table.sourceDocumentId)],
);

export const TASK_DOCUMENT_SOURCES = [
  "description",
  "comment",
  "document",
  "share",
] as const;
export type TaskDocumentSource = (typeof TASK_DOCUMENT_SOURCES)[number];

// A link between an issue and a document, found in the text of one of them.
// One row per place the link was found, so each place is kept right alone.
// A "share" row is made by sharing the document with the issue, not by text.
export const taskDocumentTable = pgTable(
  "task_document",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    source: text("source").$type<TaskDocumentSource>().notNull(),
    // Who saved the text the link was first found in.
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    // A link alone lets nobody into the document.
    grantsAccess: boolean("grants_access").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.documentId, table.source] }),
    index("task_document_document_idx").on(table.documentId),
  ],
);

export const REFERENCE_PLACES = ["description", "comment", "document"] as const;
export type ReferencePlace = (typeof REFERENCE_PLACES)[number];

// Where a ticket's or a document's text names a ticket, a document or a team,
// by address or by a typed key. One row per place in the source, kept right on
// every save of that place. A row lets nobody into anything.
export const referenceTable = pgTable(
  "reference",
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
    // Exactly one source and one target is set.
    sourceTaskId: text("source_task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    sourceDocumentId: text("source_document_id").references(
      () => documentTable.id,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
    place: text("place").$type<ReferencePlace>().notNull(),
    targetTaskId: text("target_task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    targetDocumentId: text("target_document_id").references(
      () => documentTable.id,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
    targetProjectId: text("target_project_id").references(
      () => projectTable.id,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("reference_uidx")
      .on(
        table.sourceTaskId,
        table.sourceDocumentId,
        table.place,
        table.targetTaskId,
        table.targetDocumentId,
        table.targetProjectId,
      )
      .nullsNotDistinct(),
    check(
      "reference_one_source",
      sql`num_nonnulls(${table.sourceTaskId}, ${table.sourceDocumentId}) = 1`,
    ),
    check(
      "reference_one_target",
      sql`num_nonnulls(${table.targetTaskId}, ${table.targetDocumentId}, ${table.targetProjectId}) = 1`,
    ),
    // The unique index above leads with the source ticket.
    index("reference_source_document_idx").on(table.sourceDocumentId),
    index("reference_target_task_idx").on(table.targetTaskId),
    index("reference_target_document_idx").on(table.targetDocumentId),
    index("reference_target_project_idx").on(table.targetProjectId),
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

// A page saved for anyone in the workspace to start a document from. A copy:
// later edits to the page, or to documents made from it, leave it as it is.
export const documentTemplateTable = pgTable(
  "document_template",
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
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    creatorId: text("creator_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [index("document_template_workspace_idx").on(table.workspaceId)],
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

// Agent chats are private to their user within a workspace. `message` holds
// one OpenAI-format chat message (user, assistant with tool calls, or tool).
export const agentChatTable = pgTable(
  "agent_chat",
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
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("agent_chat_user_workspace_idx").on(table.userId, table.workspaceId),
  ],
);

export const agentMessageTable = pgTable(
  "agent_message",
  {
    seq: serial("seq").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => agentChatTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    message: jsonb("message").$type<ChatMessage>().notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [index("agent_message_chat_idx").on(table.chatId)],
);

// A write the agent proposed in a chat. Nothing changes until the person who
// asked accepts it; the row then is the audit record: the prompt, the tool
// call that proposed it, the sources, who accepted and what came back. Task and
// project ids are kept without a foreign key so the record outlives them.
export const agentProposalTable = pgTable(
  "agent_proposal",
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
    chatId: text("chat_id").references(() => agentChatTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    toolCallId: text("tool_call_id").notNull(),
    tool: text("tool").notNull(),
    arguments: jsonb("arguments").$type<Record<string, unknown>>().notNull(),
    taskId: text("task_id"),
    projectId: text("project_id").notNull(),
    prompt: text("prompt").notNull(),
    toolCalls: jsonb("tool_calls")
      .$type<{ id: string; name: string; arguments: string }[]>()
      .notNull(),
    sources: jsonb("sources")
      .$type<{ kind: "task" | "document" | "comment"; id: string }[]>()
      .notNull(),
    diff: jsonb("diff")
      .$type<{ field: string; from: string | null; to: string | null }[]>()
      .notNull(),
    reason: text("reason").notNull(),
    status: text("status")
      .$type<"pending" | "accepted" | "declined" | "failed">()
      .default("pending")
      .notNull(),
    decidedBy: text("decided_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    decidedAt: timestamp("decided_at", { mode: "date" }),
    result: text("result"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("agent_proposal_chat_idx").on(table.chatId),
    index("agent_proposal_workspace_decided_idx").on(
      table.workspaceId,
      table.decidedAt,
    ),
  ],
);

// Team chat. A public channel is open to every workspace member; a private
// one only to its members. Archiving keeps the history readable. A direct
// message is a private channel whose `directKey` (its sorted member ids) keeps
// one conversation per set of people.
export const chatChannelTable = pgTable(
  "chat_channel",
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
    topic: text("topic"),
    isPrivate: boolean("is_private").default(false).notNull(),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    directKey: text("direct_key"),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("chat_channel_workspace_idx").on(table.workspaceId),
    uniqueIndex("chat_channel_workspace_direct_key_idx").on(
      table.workspaceId,
      table.directKey,
    ),
  ],
);

export const chatChannelMemberTable = pgTable(
  "chat_channel_member",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => chatChannelTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    joinedAt: timestamp("joined_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    // Private to the member: no response shows it to anyone else.
    lastReadAt: timestamp("last_read_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.channelId, table.userId] }),
    index("chat_channel_member_user_idx").on(table.userId),
  ],
);

export const chatMessageTable = pgTable(
  "chat_message",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => chatChannelTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    body: text("body").notNull(),
    // Set only by the author's edits, so pinning never reads as an edit.
    editedAt: timestamp("edited_at", { mode: "date" }),
    pinnedAt: timestamp("pinned_at", { mode: "date" }),
    pinnedBy: text("pinned_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    // Filled after posting from the first web link; the author can remove it.
    linkPreview: jsonb("link_preview").$type<LinkPreview>(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("chat_message_channel_created_idx").on(
      table.channelId,
      table.createdAt,
    ),
    index("chat_message_search_idx").using("gin", bodyVector(table.body)),
  ],
);

// One row per user and emoji on a chat message, like comment_reaction.
export const chatMessageReactionTable = pgTable(
  "chat_message_reaction",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessageTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("chat_message_reaction_message_id_idx").on(table.messageId),
    unique("chat_message_reaction_message_user_emoji_unique").on(
      table.messageId,
      table.userId,
      table.emoji,
    ),
  ],
);

// Chat presence is opt-in: a row exists only while the user has it on, so
// turning it off deletes the row and the dot is gone at once.
export const chatPresenceTable = pgTable("chat_presence", {
  userId: text("user_id")
    .primaryKey()
    .references(() => userTable.id, { onDelete: "cascade" }),
  lastSeenAt: timestamp("last_seen_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

// A loop runs its instructions as the agent on a schedule, with the creator's
// permissions at run time. Disabled loops keep their `nextRunAt` but never run.
export const loopTable = pgTable(
  "loop",
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
    creatorId: text("creator_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    instructions: text("instructions").notNull(),
    // The agent write tools a run may use (see WRITE_TOOLS). Empty: read-only.
    actions: text("actions")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // "schedule" loops use frequency/nextRunAt; event loops fire from the bus
    // for tasks in the workspace, narrowed to projectId when it is set.
    trigger: text("trigger")
      .$type<
        "schedule" | "task_created" | "task_status_changed" | "comment_created"
      >()
      .default("schedule")
      .notNull(),
    projectId: text("project_id").references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    frequency: text("frequency").$type<
      "hourly" | "daily" | "weekly" | "monthly" | "yearly"
    >(),
    enabled: boolean("enabled").default(true).notNull(),
    nextRunAt: timestamp("next_run_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .default(utcNow)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("loop_workspace_idx").on(table.workspaceId),
    index("loop_due_idx").on(table.enabled, table.nextRunAt),
  ],
);

export const loopRunTable = pgTable(
  "loop_run",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    loopId: text("loop_id")
      .notNull()
      .references(() => loopTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    trigger: text("trigger").$type<"schedule" | "manual" | "event">().notNull(),
    status: text("status")
      .$type<"running" | "succeeded" | "failed">()
      .notNull(),
    error: text("error"),
    messages: jsonb("messages").$type<ChatMessage[]>().notNull().default([]),
    startedAt: timestamp("started_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    finishedAt: timestamp("finished_at", { mode: "date" }),
  },
  (table) => [index("loop_run_loop_idx").on(table.loopId, table.startedAt)],
);

// One row for each model call. Calls for a person (assistant, loops) name the
// workspace and person and count against that workspace's budgets; jobs that
// read documents name neither and count against the instance extraction caps.
export const aiUsageTable = pgTable(
  "ai_usage",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    purpose: text("purpose").notNull(),
    model: text("model").notNull(),
    // Plain columns, no foreign keys: ai_usage already holds rows on live
    // installs, so its upgrade only adds nullable columns and an index.
    workspaceId: text("workspace_id"),
    userId: text("user_id"),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    cost: doublePrecision("cost"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("ai_usage_created_at_idx").on(table.createdAt),
    index("ai_usage_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

// A workspace's AI token budgets. Null means no limit; 0 stops every call.
export const aiBudgetTable = pgTable("ai_budget", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaceTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  userDailyTokens: integer("user_daily_tokens"),
  workspaceMonthlyTokens: integer("workspace_monthly_tokens"),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(utcNow)
    .notNull(),
});

// Where a workspace's AI calls send its text: each row is one change an admin
// made, and the newest row is the setting in force. Without a row the server
// default applies. The rows are also the AI audit's record of the setting.
export const aiDestinationChangeTable = pgTable(
  "ai_destination_change",
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
    provider: text("provider").$type<"openrouter" | "self-hosted">().notNull(),
    // The self-hosted model's name; null for OpenRouter, whose model the
    // server sets.
    model: text("model"),
    changedBy: text("changed_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    diff: jsonb("diff")
      .$type<{ field: string; from: string | null; to: string | null }[]>()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("ai_destination_change_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const SLOT_TYPES = [
  "date",
  "number",
  "money",
  "person",
  "enum",
  "bool",
  "term",
] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

// A fact a topic keeps track of, such as its launch date. People choose a
// topic's slots.
export const topicSlotTable = pgTable(
  "topic_slot",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topicTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // What a statement names the slot by. Unique on its topic.
    key: text("key").notNull(),
    name: text("name").notNull(),
    type: text("type").$type<SlotType>().notNull(),
    // The values of an `enum` slot.
    options: text("options").array(),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    uniqueIndex("topic_slot_topic_key_uidx").on(table.topicId, table.key),
  ],
);

export const STATEMENT_STATUSES = [
  "proposed",
  "confirmed",
  "rejected",
] as const;
export type StatementStatus = (typeof STATEMENT_STATUSES)[number];
export const STATEMENT_SOURCES = ["person", "assistant", "model"] as const;
export type StatementSource = (typeof STATEMENT_SOURCES)[number];
/** What happened to a statement that was sent for a document. */
export const STATEMENT_RESULTS = [
  "added",
  "unknown_slot",
  "quote_not_found",
  "invalid_value",
  "exists",
] as const;
export type StatementResult = (typeof STATEMENT_RESULTS)[number];

// The value one document states for one slot, with the passage that says so.
// The status is only what a person did. Whether a statement is the topic's
// current one is never stored: it is the confirmed statement of the topic's
// current document, written for the text that was approved.
export const statementTable = pgTable(
  "statement",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    slotId: text("slot_id")
      .notNull()
      .references(() => topicSlotTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    value: text("value").notNull(),
    // The value in the form two statements are compared in.
    normalized: text("normalized").notNull(),
    // Copied from the document's text, and where it starts there.
    quote: text("quote").notNull(),
    quoteStart: integer("quote_start").notNull(),
    // The document's `contentHash` the quote was checked against. A statement
    // for another text of the document says nothing about this one. A further
    // value of a slot on the same text has `#` and its value's hash after it
    // (see topic/statement-hash.ts).
    contentHash: text("content_hash").notNull(),
    status: text("status")
      .$type<StatementStatus>()
      .notNull()
      .default("proposed"),
    statusReason: text("status_reason"),
    source: text("source").$type<StatementSource>().notNull(),
    decidedBy: text("decided_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    decidedAt: timestamp("decided_at", { mode: "date" }),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("statement_document_idx").on(table.documentId),
    // One statement a slot for each text of a document. Rejected ones stay
    // as a record beside it.
    uniqueIndex("statement_slot_document_hash_uidx")
      .on(table.slotId, table.documentId, table.contentHash)
      .where(sql`${table.status} <> 'rejected'`),
    check(
      "statement_rejected_has_reason",
      sql`${table.status} <> 'rejected' OR ${table.statusReason} IS NOT NULL`,
    ),
  ],
);

export const CONFLICT_DECISIONS = ["replace", "tolerate", "dismiss"] as const;
export type ConflictDecision = (typeof CONFLICT_DECISIONS)[number];

// A conflict is found by comparing what a document states with what its
// topic's current document states. It is not stored: it is there for as long
// as the two values differ. This holds only what a decider said about one:
// the document's value stands (`replace`), or the two may differ until a date
// (`tolerate`). No row means the conflict is open. `pairHash` names the slot,
// the two documents and the two values, so a changed value is a new conflict.
export const statementConflictTable = pgTable(
  "statement_conflict",
  {
    pairHash: text("pair_hash").primaryKey(),
    slotId: text("slot_id")
      .notNull()
      .references(() => topicSlotTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    againstDocumentId: text("against_document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    decision: text("decision").$type<ConflictDecision>().notNull(),
    reason: text("reason").notNull(),
    tolerateUntil: timestamp("tolerate_until", { mode: "date" }),
    decidedBy: text("decided_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    decidedAt: timestamp("decided_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    index("statement_conflict_document_idx").on(table.documentId),
    check(
      "statement_conflict_tolerate_has_date",
      sql`${table.decision} <> 'tolerate' OR ${table.tolerateUntil} IS NOT NULL`,
    ),
  ],
);

// A ticket a document's change receipt suggested and a person accepted. The
// row is written before the ticket, so a second accept of the same suggestion
// is refused; it goes with the ticket, and the suggestion comes back.
export const receiptTicketTable = pgTable(
  "receipt_ticket",
  {
    documentId: text("document_id")
      .notNull()
      .references(() => documentTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Names the slot, the document and the value the suggestion is for.
    suggestionKey: text("suggestion_key").notNull(),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    acceptedBy: text("accepted_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    acceptedAt: timestamp("accepted_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.suggestionKey] })],
);

// What the model said about two wordings of one fact: whether both can hold.
// Keyed by the texts it was shown, the prompt and the model, so that the same
// question is asked once. `contradicts` is null when the answer could not be
// read.
export const statementJudgementTable = pgTable(
  "statement_judgement",
  {
    textsHash: text("texts_hash").notNull(),
    promptVersion: integer("prompt_version").notNull(),
    model: text("model").notNull(),
    contradicts: boolean("contradicts"),
    // The workspace whose documents were compared, so the day's questions
    // are counted per workspace. Another workspace with the same texts reuses
    // the answer. A plain column, no foreign key: the table already holds
    // rows on live installs, so its upgrade only adds a nullable column. A
    // deleted workspace's id stays and counts for nobody.
    workspaceId: text("workspace_id"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.textsHash, table.promptVersion, table.model],
    }),
  ],
);

// Work that relies on a statement: an issue or a document. When the topic
// stops stating that value, the work is flagged until someone clears the
// flag. `causeStatementId` is the statement whose change raised the flag: this
// one, or one further up a chain of documents that depend on each other.
export const statementDependencyTable = pgTable(
  "statement_dependency",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    statementId: text("statement_id")
      .notNull()
      .references(() => statementTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("task_id").references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    documentId: text("document_id").references(() => documentTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    needsReviewAt: timestamp("needs_review_at", { mode: "date" }),
    causeStatementId: text("cause_statement_id").references(
      () => statementTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    uniqueIndex("statement_dependency_task_uidx")
      .on(table.statementId, table.taskId)
      .where(sql`${table.taskId} IS NOT NULL`),
    uniqueIndex("statement_dependency_document_uidx")
      .on(table.statementId, table.documentId)
      .where(sql`${table.documentId} IS NOT NULL`),
    index("statement_dependency_document_idx").on(table.documentId),
    check(
      "statement_dependency_one_work",
      sql`(${table.taskId} IS NULL) <> (${table.documentId} IS NULL)`,
    ),
  ],
);

// One row for each text the model was asked about, so that a text is read
// once. An answer nobody could read is kept too: asking again would cost the
// same and read the same.
export const documentExtractionTable = pgTable(
  "document_extraction",
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
    contentHash: text("content_hash").notNull(),
    // The slots that were asked about, so that a new slot is asked about too.
    slotsHash: text("slots_hash").notNull(),
    promptVersion: integer("prompt_version").notNull(),
    model: text("model").notNull(),
    readable: boolean("readable").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    uniqueIndex("document_extraction_uidx").on(
      table.documentId,
      table.contentHash,
      table.slotsHash,
      table.promptVersion,
      table.model,
    ),
  ],
);

// One row for each text of an issue the model was asked about: the issue's
// own words (no file) or one file on it. A file that was not read gets a row
// too, with the reason, so that every source has an answer to "was it read?".
export const taskExtractionTable = pgTable(
  "task_extraction",
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
    // Empty for the issue's title, description and comments.
    assetId: text("asset_id").references(() => assetTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    // Of the text that was asked about. Empty for a file that was not read.
    contentHash: text("content_hash").notNull(),
    slotsHash: text("slots_hash").notNull(),
    promptVersion: integer("prompt_version").notNull(),
    model: text("model").notNull(),
    readable: boolean("readable").notNull(),
    // Why not: unsupported, too_large, unparsed, no_answer, or duplicate for
    // a file whose text another file holds. `truncated` only on records
    // from before every text was read whole; those are read once again.
    reason: text("reason"),
    // When the newest slot the text was asked about was made, not when the
    // row was written: the job sets it.
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("task_extraction_uidx")
      .on(
        table.taskId,
        table.assetId,
        table.contentHash,
        table.slotsHash,
        table.promptVersion,
        table.model,
      )
      .nullsNotDistinct(),
  ],
);

// How far a text that stopped part way was read, and whether a part of it
// had an answer, so the next run goes on with the parts that are left, after
// a restart too. One row for each text and question; it goes once the text
// is read to its end or recorded.
export const taskExtractionProgressTable = pgTable("task_extraction_progress", {
  // The issue or file, the hash of its text and the hash of the question.
  key: text("key").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => taskTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Empty for the issue's title, description and comments.
  assetId: text("asset_id").references(() => assetTable.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  next: integer("next").notNull(),
  readable: boolean("readable").notNull(),
});

// A fact the model found in an issue or in a file on it, for a slot of a
// topic. It is a proposal only: it never changes what the topic states. A
// person puts the issue on the topic or dismisses the fact, and a dismissed
// fact stays dismissed when the issue is read again.
export const taskStatementTable = pgTable(
  "task_statement",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    slotId: text("slot_id")
      .notNull()
      .references(() => topicSlotTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("task_id")
      .notNull()
      .references(() => taskTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // The file the quote is from. Empty when it is from the issue itself.
    assetId: text("asset_id").references(() => assetTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    value: text("value").notNull(),
    normalized: text("normalized").notNull(),
    quote: text("quote").notNull(),
    dismissedBy: text("dismissed_by").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    dismissedAt: timestamp("dismissed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
  },
  (table) => [
    unique("task_statement_uidx")
      .on(table.slotId, table.taskId, table.assetId, table.normalized)
      .nullsNotDistinct(),
    index("task_statement_task_idx").on(table.taskId),
  ],
);

// One row per scheduled or manual database backup. `counts` holds the row
// counts of the tables a restore test compares, taken in the dump's snapshot.
export const backupRunTable = pgTable(
  "backup_run",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    status: text("status")
      .$type<"running" | "succeeded" | "failed">()
      .notNull(),
    objectKey: text("object_key"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    offsiteStatus: text("offsite_status").$type<"ok" | "failed">(),
    errorCode: text("error_code"),
    counts: jsonb("counts").$type<Record<string, number>>(),
    startedAt: timestamp("started_at", { mode: "date" })
      .default(utcNow)
      .notNull(),
    finishedAt: timestamp("finished_at", { mode: "date" }),
  },
  (table) => [index("backup_run_started_idx").on(table.startedAt)],
);
