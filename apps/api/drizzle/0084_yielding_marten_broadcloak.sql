CREATE TABLE "document_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text,
	"parent_id" text,
	"content" text NOT NULL,
	"quoted_text" text,
	"resolved_at" timestamp,
	"resolved_by_id" text,
	"external_source" text,
	"external_id" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_share" (
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access" text DEFAULT 'edit' NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "document_share_document_id_user_id_pk" PRIMARY KEY("document_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "document_subscriber" (
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "document_subscriber_document_id_user_id_pk" PRIMARY KEY("document_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"icon" text,
	"color" text,
	"content" text DEFAULT '' NOT NULL,
	"scope" text DEFAULT 'private' NOT NULL,
	"project_id" text,
	"work_project_id" text,
	"task_id" text,
	"general_access" text DEFAULT 'edit' NOT NULL,
	"creator_id" text,
	"updated_by_id" text,
	"deleted_at" timestamp,
	"external_source" text,
	"external_id" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "document_scope_parent" CHECK (CASE "document"."scope"
        WHEN 'team' THEN "document"."project_id" IS NOT NULL AND num_nonnulls("document"."work_project_id", "document"."task_id") = 0
        WHEN 'project' THEN "document"."work_project_id" IS NOT NULL AND num_nonnulls("document"."project_id", "document"."task_id") = 0
        WHEN 'issue' THEN "document"."task_id" IS NOT NULL AND num_nonnulls("document"."project_id", "document"."work_project_id") = 0
        WHEN 'private' THEN num_nonnulls("document"."project_id", "document"."work_project_id", "document"."task_id") = 0
        WHEN 'workspace' THEN num_nonnulls("document"."project_id", "document"."work_project_id", "document"."task_id") = 0
        ELSE false END)
);
--> statement-breakpoint
CREATE TABLE "document_version" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"author_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_parent_id_document_comment_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."document_comment"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_share" ADD CONSTRAINT "document_share_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_share" ADD CONSTRAINT "document_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_subscriber" ADD CONSTRAINT "document_subscriber_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_subscriber" ADD CONSTRAINT "document_subscriber_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_comment_document_idx" ON "document_comment" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_comment_external_unique" ON "document_comment" USING btree ("document_id","external_source","external_id");--> statement-breakpoint
CREATE INDEX "document_share_user_idx" ON "document_share" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_subscriber_user_idx" ON "document_subscriber" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_workspace_idx" ON "document" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "document_project_idx" ON "document" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "document_work_project_idx" ON "document" USING btree ("work_project_id");--> statement-breakpoint
CREATE INDEX "document_task_idx" ON "document" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "document_creator_idx" ON "document" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_external_unique" ON "document" USING btree ("workspace_id","external_source","external_id");--> statement-breakpoint
CREATE INDEX "document_version_document_idx" ON "document_version" USING btree ("document_id","created_at");