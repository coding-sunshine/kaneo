CREATE TABLE "reference" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source_task_id" text,
	"source_document_id" text,
	"place" text NOT NULL,
	"target_task_id" text,
	"target_document_id" text,
	"target_project_id" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "reference_uidx" UNIQUE NULLS NOT DISTINCT("source_task_id","source_document_id","place","target_task_id","target_document_id","target_project_id"),
	CONSTRAINT "reference_one_source" CHECK (num_nonnulls("reference"."source_task_id", "reference"."source_document_id") = 1),
	CONSTRAINT "reference_one_target" CHECK (num_nonnulls("reference"."target_task_id", "reference"."target_document_id", "reference"."target_project_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_source_task_id_task_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_source_document_id_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_target_task_id_task_id_fk" FOREIGN KEY ("target_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_target_document_id_document_id_fk" FOREIGN KEY ("target_document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "reference" ADD CONSTRAINT "reference_target_project_id_project_id_fk" FOREIGN KEY ("target_project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "reference_source_document_idx" ON "reference" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "reference_target_task_idx" ON "reference" USING btree ("target_task_id");--> statement-breakpoint
CREATE INDEX "reference_target_document_idx" ON "reference" USING btree ("target_document_id");--> statement-breakpoint
CREATE INDEX "reference_target_project_idx" ON "reference" USING btree ("target_project_id");