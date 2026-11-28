CREATE TABLE "chat_reminder" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"remind_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_reminder" ADD CONSTRAINT "chat_reminder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_reminder" ADD CONSTRAINT "chat_reminder_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_reminder" ADD CONSTRAINT "chat_reminder_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chat_reminder_due_idx" ON "chat_reminder" USING btree ("sent_at","remind_at");--> statement-breakpoint
CREATE INDEX "chat_reminder_user_idx" ON "chat_reminder" USING btree ("user_id");