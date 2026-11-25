CREATE TABLE "statement_judgement" (
	"texts_hash" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"model" text NOT NULL,
	"contradicts" boolean,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "statement_judgement_texts_hash_prompt_version_model_pk" PRIMARY KEY("texts_hash","prompt_version","model")
);
