CREATE TABLE "statement_dependency" (
	"id" text PRIMARY KEY NOT NULL,
	"statement_id" text NOT NULL,
	"task_id" text,
	"document_id" text,
	"needs_review_at" timestamp,
	"cause_statement_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "statement_dependency_one_work" CHECK (("statement_dependency"."task_id" IS NULL) <> ("statement_dependency"."document_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "statement_dependency" ADD CONSTRAINT "statement_dependency_statement_id_statement_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statement"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_dependency" ADD CONSTRAINT "statement_dependency_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_dependency" ADD CONSTRAINT "statement_dependency_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_dependency" ADD CONSTRAINT "statement_dependency_cause_statement_id_statement_id_fk" FOREIGN KEY ("cause_statement_id") REFERENCES "public"."statement"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_dependency" ADD CONSTRAINT "statement_dependency_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "statement_dependency_task_uidx" ON "statement_dependency" USING btree ("statement_id","task_id") WHERE "statement_dependency"."task_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "statement_dependency_document_uidx" ON "statement_dependency" USING btree ("statement_id","document_id") WHERE "statement_dependency"."document_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "statement_dependency_document_idx" ON "statement_dependency" USING btree ("document_id");