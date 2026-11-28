CREATE TABLE "chat_assistant_reply" (
	"message_id" text PRIMARY KEY NOT NULL,
	"asked_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_feature_setting" ADD COLUMN "chat_assistant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_assistant_reply" ADD CONSTRAINT "chat_assistant_reply_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_assistant_reply" ADD CONSTRAINT "chat_assistant_reply_asked_by_user_id_fk" FOREIGN KEY ("asked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chat_assistant_reply_asked_by_idx" ON "chat_assistant_reply" USING btree ("asked_by");