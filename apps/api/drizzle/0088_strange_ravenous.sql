CREATE TABLE "agent_chat" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_message" (
	"seq" serial PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"message" jsonb NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loop_run" (
	"id" text PRIMARY KEY NOT NULL,
	"loop_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "loop" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"name" text NOT NULL,
	"instructions" text NOT NULL,
	"frequency" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_chat" ADD CONSTRAINT "agent_chat_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_chat" ADD CONSTRAINT "agent_chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_chat_id_agent_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."agent_chat"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "loop_run" ADD CONSTRAINT "loop_run_loop_id_loop_id_fk" FOREIGN KEY ("loop_id") REFERENCES "public"."loop"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "loop" ADD CONSTRAINT "loop_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "loop" ADD CONSTRAINT "loop_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "agent_chat_user_workspace_idx" ON "agent_chat" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "agent_message_chat_idx" ON "agent_message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "loop_run_loop_idx" ON "loop_run" USING btree ("loop_id","started_at");--> statement-breakpoint
CREATE INDEX "loop_workspace_idx" ON "loop" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "loop_due_idx" ON "loop" USING btree ("enabled","next_run_at");