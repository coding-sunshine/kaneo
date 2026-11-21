ALTER TABLE "task" ADD COLUMN "source_comment_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_source_comment_id_activity_id_fk" FOREIGN KEY ("source_comment_id") REFERENCES "public"."activity"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_sourceCommentId_idx" ON "task" USING btree ("source_comment_id");