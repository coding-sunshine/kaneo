CREATE TABLE "task_topic" (
	"task_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_topic_task_id_topic_id_pk" PRIMARY KEY("task_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topic_subscriber" (
	"topic_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "topic_subscriber_topic_id_user_id_pk" PRIMARY KEY("topic_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT 'workspace' NOT NULL,
	"project_id" text,
	"work_project_id" text,
	"decider_id" text,
	"backup_decider_id" text,
	"creator_id" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "topic_scope_parent" CHECK (CASE "topic"."scope"
        WHEN 'team' THEN "topic"."project_id" IS NOT NULL AND "topic"."work_project_id" IS NULL
        WHEN 'project' THEN "topic"."work_project_id" IS NOT NULL AND "topic"."project_id" IS NULL
        WHEN 'workspace' THEN num_nonnulls("topic"."project_id", "topic"."work_project_id") = 0
        ELSE false END)
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "topic_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "filed_at" timestamp;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "approved_hash" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "approved_version_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "supersedes_document_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "task_topic" ADD CONSTRAINT "task_topic_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_topic" ADD CONSTRAINT "task_topic_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic_subscriber" ADD CONSTRAINT "topic_subscriber_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic_subscriber" ADD CONSTRAINT "topic_subscriber_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_decider_id_user_id_fk" FOREIGN KEY ("decider_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_backup_decider_id_user_id_fk" FOREIGN KEY ("backup_decider_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_topic_topic_idx" ON "task_topic" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topic_subscriber_user_idx" ON "topic_subscriber" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topic_workspace_idx" ON "topic" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_approved_version_id_document_version_id_fk" FOREIGN KEY ("approved_version_id") REFERENCES "public"."document_version"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_supersedes_document_id_document_id_fk" FOREIGN KEY ("supersedes_document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_topic_idx" ON "document" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_current" ON "document" USING btree ("topic_id") WHERE "document"."status" = 'current' AND "document"."deleted_at" IS NULL;