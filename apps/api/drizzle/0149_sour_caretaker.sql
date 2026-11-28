CREATE TABLE "ai_feature_setting" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"triage" boolean DEFAULT false NOT NULL,
	"pr_summary" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_triage_setting" (
	"project_id" text PRIMARY KEY NOT NULL,
	"guidance" text DEFAULT '' NOT NULL,
	"auto_apply" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coding_agent_run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"task_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"requested_by" text,
	"agent" text NOT NULL,
	"status" text DEFAULT 'starting' NOT NULL,
	"external_id" text,
	"pull_request_url" text,
	"token_hash" text NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "coding_agent_run_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
ALTER TABLE "chat_channel" ADD COLUMN "ai_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_feature_setting" ADD CONSTRAINT "ai_feature_setting_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_feature_setting" ADD CONSTRAINT "ai_feature_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_triage_setting" ADD CONSTRAINT "ai_triage_setting_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_triage_setting" ADD CONSTRAINT "ai_triage_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coding_agent_run" ADD CONSTRAINT "coding_agent_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "coding_agent_run" ADD CONSTRAINT "coding_agent_run_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "coding_agent_run_task_idx" ON "coding_agent_run" USING btree ("task_id");