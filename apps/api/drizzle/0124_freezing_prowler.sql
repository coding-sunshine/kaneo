CREATE TABLE "agent_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"chat_id" text,
	"user_id" text,
	"tool_call_id" text NOT NULL,
	"tool" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"task_id" text,
	"project_id" text NOT NULL,
	"prompt" text NOT NULL,
	"tool_calls" jsonb NOT NULL,
	"sources" jsonb NOT NULL,
	"diff" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp,
	"result" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_proposal" ADD CONSTRAINT "agent_proposal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_proposal" ADD CONSTRAINT "agent_proposal_chat_id_agent_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."agent_chat"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_proposal" ADD CONSTRAINT "agent_proposal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_proposal" ADD CONSTRAINT "agent_proposal_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "agent_proposal_chat_idx" ON "agent_proposal" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "agent_proposal_workspace_decided_idx" ON "agent_proposal" USING btree ("workspace_id","decided_at");