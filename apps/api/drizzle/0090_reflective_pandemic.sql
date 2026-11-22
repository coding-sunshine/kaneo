CREATE TABLE "work_project_update" (
	"id" text PRIMARY KEY NOT NULL,
	"work_project_id" text NOT NULL,
	"user_id" text,
	"health" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_project_update" ADD CONSTRAINT "work_project_update_work_project_id_work_project_id_fk" FOREIGN KEY ("work_project_id") REFERENCES "public"."work_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_project_update" ADD CONSTRAINT "work_project_update_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_project_update_projectId_idx" ON "work_project_update" USING btree ("work_project_id","created_at");