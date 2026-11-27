CREATE TABLE "document_template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"creator_id" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "parent_document_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "inbox_since" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "inbox_reminded_at" timestamp;--> statement-breakpoint
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_template_workspace_idx" ON "document_template" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "document_parent_document_idx" ON "document" USING btree ("parent_document_id");