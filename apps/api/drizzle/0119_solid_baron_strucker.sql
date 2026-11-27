CREATE TABLE "chat_channel_member" (
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "chat_channel_member_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_channel" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"topic" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_channel_member" ADD CONSTRAINT "chat_channel_member_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_channel_member" ADD CONSTRAINT "chat_channel_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_channel" ADD CONSTRAINT "chat_channel_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_channel" ADD CONSTRAINT "chat_channel_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "chat_channel_member_user_idx" ON "chat_channel_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_channel_workspace_idx" ON "chat_channel" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chat_message_channel_created_idx" ON "chat_message" USING btree ("channel_id","created_at");