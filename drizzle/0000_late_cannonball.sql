CREATE TABLE "module_openrouter_credit_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entry_type" text NOT NULL,
	"order_id" text,
	"sku" text,
	"quantity" integer,
	"units" integer NOT NULL,
	"level" text,
	"model" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "module_openrouter_credit_ledger_order_id_idx" ON "module_openrouter_credit_ledger" USING btree ("order_id");