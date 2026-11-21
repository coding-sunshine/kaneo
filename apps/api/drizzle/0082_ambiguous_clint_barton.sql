CREATE TABLE "workspace_emoji" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"version" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "workspace_emoji_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "workspace_emoji_workspace_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
ALTER TABLE "workspace_emoji" ADD CONSTRAINT "workspace_emoji_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace_emoji" ADD CONSTRAINT "workspace_emoji_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;