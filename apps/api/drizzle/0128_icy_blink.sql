CREATE TABLE "chat_message_reaction" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "chat_message_reaction_message_user_emoji_unique" UNIQUE("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "chat_presence" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_channel_member" ADD COLUMN "last_read_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "pinned_at" timestamp;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "pinned_by" text;--> statement-breakpoint
ALTER TABLE "chat_message_reaction" ADD CONSTRAINT "chat_message_reaction_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_reaction" ADD CONSTRAINT "chat_message_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_presence" ADD CONSTRAINT "chat_presence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_reaction_message_id_idx" ON "chat_message_reaction" USING btree ("message_id");--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_pinned_by_user_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;