ALTER TABLE "project" ADD COLUMN "auto_archive_months" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "archived_at" timestamp;