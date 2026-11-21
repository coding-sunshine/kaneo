CREATE TABLE "work_project_member" (
	"work_project_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "work_project_member_work_project_id_user_id_pk" PRIMARY KEY("work_project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "work_project_milestone" (
	"id" text PRIMARY KEY NOT NULL,
	"work_project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_date" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "work_project_milestone_name_unique" UNIQUE("work_project_id","name")
);
--> statement-breakpoint
CREATE TABLE "work_project" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text DEFAULT '#bec2c8' NOT NULL,
	"status" text DEFAULT 'backlog' NOT NULL,
	"health" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"lead_id" text,
	"start_date" timestamp,
	"target_date" timestamp,
	"summary" text,
	"description" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "work_project_workspace_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "work_project_team" (
	"work_project_id" text NOT NULL,
	"project_id" text NOT NULL,
	CONSTRAINT "work_project_team_work_project_id_project_id_pk" PRIMARY KEY("work_project_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "work_project_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "work_project_milestone_id" text;--> statement-breakpoint
ALTER TABLE "work_project_member" ADD CONSTRAINT "work_project_member_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project_member" ADD CONSTRAINT "work_project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project_milestone" ADD CONSTRAINT "work_project_milestone_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project" ADD CONSTRAINT "work_project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "work_project" ADD CONSTRAINT "work_project_lead_id_user_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "work_project_team" ADD CONSTRAINT "work_project_team_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project_team" ADD CONSTRAINT "work_project_team_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_project_member_userId_idx" ON "work_project_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "work_project_milestone_projectId_idx" ON "work_project_milestone" USING btree ("work_project_id");--> statement-breakpoint
CREATE INDEX "work_project_workspaceId_idx" ON "work_project" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "work_project_team_projectId_idx" ON "work_project_team" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_work_project_milestone_id_work_project_milestone_id_fk" FOREIGN KEY ("work_project_milestone_id") REFERENCES "public"."work_project_milestone"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_workProjectId_idx" ON "task" USING btree ("work_project_id");