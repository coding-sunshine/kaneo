CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc'),
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "workspace_webhook_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status_code" integer,
	"error_code" text,
	"next_attempt_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_webhook" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"resource_types" text[] NOT NULL,
	"project_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "sla_warning_notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "sla_breached_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_days" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_start" text DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "schedule_end" text DEFAULT '18:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhook_delivery" ADD CONSTRAINT "workspace_webhook_delivery_webhook_id_workspace_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."workspace_webhook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhook" ADD CONSTRAINT "workspace_webhook_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_webhook" ADD CONSTRAINT "workspace_webhook_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "workspace_webhook_delivery_due_idx" ON "workspace_webhook_delivery" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "workspace_webhook_workspace_idx" ON "workspace_webhook" USING btree ("workspace_id");