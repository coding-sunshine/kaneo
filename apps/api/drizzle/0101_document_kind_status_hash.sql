ALTER TABLE "document" ADD COLUMN "kind" text DEFAULT 'unsorted' NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "source_client" text;--> statement-breakpoint
-- SHA-256 of the text in UTF-8, kept by the database so every writer of
-- document.content (API, imports, sync scripts) stores the same value and none
-- can store another. convert_to is only STABLE, which rules out a generated
-- column.
CREATE FUNCTION document_content_hash() RETURNS trigger AS $$
BEGIN
  NEW.content_hash := encode(sha256(convert_to(NEW.content, 'UTF8')), 'hex');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER document_content_hash BEFORE INSERT OR UPDATE OF content, content_hash ON "document"
  FOR EACH ROW EXECUTE FUNCTION document_content_hash();
--> statement-breakpoint
UPDATE "document" SET "content_hash" = encode(sha256(convert_to("content", 'UTF8')), 'hex');--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_current_not_private" CHECK (NOT ("document"."status" = 'current' AND "document"."scope" = 'private'));
