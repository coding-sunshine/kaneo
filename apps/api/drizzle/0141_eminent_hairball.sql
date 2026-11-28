CREATE TABLE "chat_draft" (
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "chat_draft_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_message_reference" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"message_id" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_draft" ADD CONSTRAINT "chat_draft_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_draft" ADD CONSTRAINT "chat_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_message_reference" ADD CONSTRAINT "chat_message_reference_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_message_reference" ADD CONSTRAINT "chat_message_reference_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chat_draft_user_idx" ON "chat_draft" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_reference_message_idx" ON "chat_message_reference" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_message_reference_target_idx" ON "chat_message_reference" USING btree ("target_kind","target_id");