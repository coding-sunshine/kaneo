CREATE TABLE "task_document" (
	"task_id" text NOT NULL,
	"document_id" text NOT NULL,
	"source" text NOT NULL,
	"created_by" text,
	"grants_access" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_document_task_id_document_id_source_pk" PRIMARY KEY("task_id","document_id","source")
);
--> statement-breakpoint
ALTER TABLE "task_document" ADD CONSTRAINT "task_document_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_document" ADD CONSTRAINT "task_document_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_document" ADD CONSTRAINT "task_document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_document_document_idx" ON "task_document" USING btree ("document_id");