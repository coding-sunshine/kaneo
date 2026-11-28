CREATE TABLE "chat_message_file" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"object_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message_file" ADD CONSTRAINT "chat_message_file_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chat_message_file_workspace_created_idx" ON "chat_message_file" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_message_file_channel_idx" ON "chat_message_file" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "chat_message_file_message_idx" ON "chat_message_file" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_message_file_object_key_idx" ON "chat_message_file" USING btree ("object_key");