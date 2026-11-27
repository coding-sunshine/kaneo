CREATE TABLE "initiative" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" text,
	"target_date" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "initiative_update" (
	"id" text PRIMARY KEY NOT NULL,
	"initiative_id" text NOT NULL,
	"user_id" text,
	"health" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "initiative_work_project" (
	"initiative_id" text NOT NULL,
	"work_project_id" text NOT NULL,
	CONSTRAINT "initiative_work_project_initiative_id_work_project_id_pk" PRIMARY KEY("initiative_id","work_project_id")
);
--> statement-breakpoint
CREATE TABLE "work_project_dependency" (
	"work_project_id" text NOT NULL,
	"depends_on_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "work_project_dependency_work_project_id_depends_on_id_pk" PRIMARY KEY("work_project_id","depends_on_id"),
	CONSTRAINT "work_project_dependency_not_self" CHECK ("work_project_dependency"."work_project_id" <> "work_project_dependency"."depends_on_id")
);
--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "initiative_update" ADD CONSTRAINT "initiative_update_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_update" ADD CONSTRAINT "initiative_update_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_work_project" ADD CONSTRAINT "initiative_work_project_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_work_project" ADD CONSTRAINT "initiative_work_project_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project_dependency" ADD CONSTRAINT "work_project_dependency_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project_dependency" ADD CONSTRAINT "work_project_dependency_depends_on_id_work_project_id_fk" FOREIGN KEY ("depends_on_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_workspaceId_idx" ON "initiative" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "initiative_update_initiativeId_idx" ON "initiative_update" USING btree ("initiative_id","created_at");--> statement-breakpoint
CREATE INDEX "initiative_work_project_workProjectId_idx" ON "initiative_work_project" USING btree ("work_project_id");--> statement-breakpoint
CREATE INDEX "work_project_dependency_dependsOnId_idx" ON "work_project_dependency" USING btree ("depends_on_id");