CREATE TABLE "ai_catch_up_preference" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"include_direct_messages" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "ai_catch_up_preference_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_skill_project" (
	"skill_id" text NOT NULL,
	"project_id" text NOT NULL,
	CONSTRAINT "ai_skill_project_skill_id_project_id_pk" PRIMARY KEY("skill_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "ai_skill_run" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_skill" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"prompt" text NOT NULL,
	"project_scope" text DEFAULT 'all' NOT NULL,
	"monthly_token_cap" integer,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_skill_usage" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"skill_name" text NOT NULL,
	"month" text NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_skill_usage_workspace_id_user_id_skill_name_month_pk" PRIMARY KEY("workspace_id","user_id","skill_name","month")
);
--> statement-breakpoint
CREATE TABLE "daily_brief_channel" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	CONSTRAINT "daily_brief_channel_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "daily_brief_preference" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "daily_brief_preference_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "daily_brief" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_notes_run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"transcript" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"message_id" text,
	"task_id" text,
	"document_id" text,
	"content_hash" text NOT NULL,
	"embedding" real[] NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"indexed_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_index_state" (
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"last_at" text NOT NULL,
	"last_id" text NOT NULL,
	CONSTRAINT "semantic_index_state_workspace_id_kind_pk" PRIMARY KEY("workspace_id","kind")
);
--> statement-breakpoint
CREATE TABLE "semantic_search_setting" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_duplicate_dismissal" (
	"id" text PRIMARY KEY NOT NULL,
	"low_task_id" text NOT NULL,
	"high_task_id" text NOT NULL,
	"dismissed_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_catch_up_preference" ADD CONSTRAINT "ai_catch_up_preference_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_catch_up_preference" ADD CONSTRAINT "ai_catch_up_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill_project" ADD CONSTRAINT "ai_skill_project_skill_id_ai_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."ai_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill_project" ADD CONSTRAINT "ai_skill_project_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill_run" ADD CONSTRAINT "ai_skill_run_skill_id_ai_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."ai_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill_run" ADD CONSTRAINT "ai_skill_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill_run" ADD CONSTRAINT "ai_skill_run_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill" ADD CONSTRAINT "ai_skill_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill" ADD CONSTRAINT "ai_skill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill_usage" ADD CONSTRAINT "ai_skill_usage_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_skill_usage" ADD CONSTRAINT "ai_skill_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_brief_channel" ADD CONSTRAINT "daily_brief_channel_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_brief_channel" ADD CONSTRAINT "daily_brief_channel_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_brief_channel" ADD CONSTRAINT "daily_brief_channel_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_brief_preference" ADD CONSTRAINT "daily_brief_preference_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_brief_preference" ADD CONSTRAINT "daily_brief_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_brief" ADD CONSTRAINT "daily_brief_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_brief" ADD CONSTRAINT "daily_brief_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes_run" ADD CONSTRAINT "meeting_notes_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes_run" ADD CONSTRAINT "meeting_notes_run_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes_run" ADD CONSTRAINT "meeting_notes_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_chunk" ADD CONSTRAINT "semantic_chunk_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_chunk" ADD CONSTRAINT "semantic_chunk_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_chunk" ADD CONSTRAINT "semantic_chunk_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_chunk" ADD CONSTRAINT "semantic_chunk_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_index_state" ADD CONSTRAINT "semantic_index_state_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_search_setting" ADD CONSTRAINT "semantic_search_setting_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_search_setting" ADD CONSTRAINT "semantic_search_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_duplicate_dismissal" ADD CONSTRAINT "task_duplicate_dismissal_low_task_id_task_id_fk" FOREIGN KEY ("low_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_duplicate_dismissal" ADD CONSTRAINT "task_duplicate_dismissal_high_task_id_task_id_fk" FOREIGN KEY ("high_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_duplicate_dismissal" ADD CONSTRAINT "task_duplicate_dismissal_dismissed_by_user_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_skill_run_skill_created_idx" ON "ai_skill_run" USING btree ("skill_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_skill_run_user_created_idx" ON "ai_skill_run" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_skill_owner_name_idx" ON "ai_skill" USING btree ("workspace_id","user_id","name");--> statement-breakpoint
CREATE INDEX "daily_brief_channel_workspace_user_idx" ON "daily_brief_channel" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "daily_brief_preference_enabled_idx" ON "daily_brief_preference" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_brief_workspace_user_day_idx" ON "daily_brief" USING btree ("workspace_id","user_id","day");--> statement-breakpoint
CREATE INDEX "meeting_notes_run_document_user_idx" ON "meeting_notes_run" USING btree ("document_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "semantic_chunk_workspace_idx" ON "semantic_chunk" USING btree ("workspace_id","indexed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "semantic_chunk_message_idx" ON "semantic_chunk" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "semantic_chunk_task_idx" ON "semantic_chunk" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "semantic_chunk_document_idx" ON "semantic_chunk" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_duplicate_dismissal_pair_idx" ON "task_duplicate_dismissal" USING btree ("low_task_id","high_task_id");--> statement-breakpoint
CREATE INDEX "task_duplicate_dismissal_high_idx" ON "task_duplicate_dismissal" USING btree ("high_task_id");