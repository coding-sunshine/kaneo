CREATE TABLE "chat_email_fallback" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL,
	"emailed_through" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_saved_message" (
	"user_id" text NOT NULL,
	"message_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "chat_saved_message_user_id_message_id_pk" PRIMARY KEY("user_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "chat_reminder" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "chat_email_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_email_fallback" ADD CONSTRAINT "chat_email_fallback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_message" ADD CONSTRAINT "chat_saved_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_message" ADD CONSTRAINT "chat_saved_message_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_saved_message" ADD CONSTRAINT "chat_saved_message_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_saved_message_user_workspace_idx" ON "chat_saved_message" USING btree ("user_id","workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_saved_message_message_idx" ON "chat_saved_message" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "notification_type_created_idx" ON "notification" USING btree ("type","created_at");