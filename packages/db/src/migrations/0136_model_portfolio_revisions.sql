CREATE TABLE "model_portfolio_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"change_reason" text NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restored_from_revision_id" uuid,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"activated_by_user_id" text,
	"approval_note" text,
	"activated_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_portfolio_revisions_status_check" CHECK ("model_portfolio_revisions"."status" in ('draft', 'active', 'superseded'))
);
--> statement-breakpoint
ALTER TABLE "model_portfolio_revisions" ADD CONSTRAINT "model_portfolio_revisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_portfolio_revisions" ADD CONSTRAINT "model_portfolio_revisions_restored_from_revision_id_model_portfolio_revisions_id_fk" FOREIGN KEY ("restored_from_revision_id") REFERENCES "public"."model_portfolio_revisions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_portfolio_revisions" ADD CONSTRAINT "model_portfolio_revisions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "model_portfolio_revisions_company_version_uq" ON "model_portfolio_revisions" USING btree ("company_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "model_portfolio_revisions_one_active_per_company_uq" ON "model_portfolio_revisions" USING btree ("company_id") WHERE "model_portfolio_revisions"."status" = 'active';
--> statement-breakpoint
CREATE INDEX "model_portfolio_revisions_company_created_idx" ON "model_portfolio_revisions" USING btree ("company_id","created_at");
