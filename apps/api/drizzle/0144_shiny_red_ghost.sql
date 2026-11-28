CREATE TABLE "chat_thread_reply" (
	"message_id" text PRIMARY KEY NOT NULL,
	"parent_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_thread_reply" ADD CONSTRAINT "chat_thread_reply_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread_reply" ADD CONSTRAINT "chat_thread_reply_parent_id_chat_message_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_thread_reply_parent_idx" ON "chat_thread_reply" USING btree ("parent_id");