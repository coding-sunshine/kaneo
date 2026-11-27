CREATE TABLE "figma_link_preview" (
	"workspace_id" text NOT NULL,
	"file_key" text NOT NULL,
	"node_id" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"file_name" text NOT NULL,
	"frame_name" text,
	"thumbnail_url" text,
	"fetched_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "figma_link_preview_workspace_id_file_key_node_id_pk" PRIMARY KEY("workspace_id","file_key","node_id")
);
--> statement-breakpoint
ALTER TABLE "figma_link_preview" ADD CONSTRAINT "figma_link_preview_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;