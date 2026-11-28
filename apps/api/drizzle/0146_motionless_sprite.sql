CREATE TABLE "chat_channel_mute" (
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "chat_channel_mute_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_channel_mute" ADD CONSTRAINT "chat_channel_mute_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_channel_mute" ADD CONSTRAINT "chat_channel_mute_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chat_channel_mute_user_idx" ON "chat_channel_mute" USING btree ("user_id");