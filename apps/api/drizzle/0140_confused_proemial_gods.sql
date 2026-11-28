CREATE TABLE "stale_item_nudge" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"week" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "stale_item_nudge_user_workspace_week_unique" UNIQUE("user_id","workspace_id","week")
);
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "stale_items_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "stale_item_nudge" ADD CONSTRAINT "stale_item_nudge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stale_item_nudge" ADD CONSTRAINT "stale_item_nudge_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;