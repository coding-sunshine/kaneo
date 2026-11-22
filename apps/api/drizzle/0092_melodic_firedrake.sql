CREATE TABLE "project_label" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "project_label_workspace_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "work_project_label" (
	"work_project_id" text NOT NULL,
	"label_id" text NOT NULL,
	CONSTRAINT "work_project_label_work_project_id_label_id_pk" PRIMARY KEY("work_project_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "label" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "label" ADD COLUMN "parent_label_id" text;--> statement-breakpoint
ALTER TABLE "project_label" ADD CONSTRAINT "project_label_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "work_project_label" ADD CONSTRAINT "work_project_label_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project_label" ADD CONSTRAINT "work_project_label_label_id_project_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."project_label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_project_label_labelId_idx" ON "work_project_label" USING btree ("label_id");--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_parent_label_id_label_id_fk" FOREIGN KEY ("parent_label_id") REFERENCES "public"."label"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "label_project_id_idx" ON "label" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "label_parent_label_id_idx" ON "label" USING btree ("parent_label_id");