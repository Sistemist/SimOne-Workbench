CREATE TABLE "venture_state_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"content" jsonb NOT NULL,
	"creation_reason" text NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"constitution_revision_id" uuid NOT NULL,
	"based_on_cycle_id" uuid,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "venture_state_revisions_status_check" CHECK ("venture_state_revisions"."status" in ('current', 'superseded'))
);
--> statement-breakpoint
CREATE TABLE "venture_context_projections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"constitution_revision_id" uuid NOT NULL,
	"venture_state_revision_id" uuid NOT NULL,
	"creation_reason" text NOT NULL,
	"content" jsonb NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supersedes_projection_id" uuid,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "venture_context_projections_status_check" CHECK ("venture_context_projections"."status" in ('current', 'superseded'))
);
--> statement-breakpoint
ALTER TABLE "venture_state_revisions" ADD CONSTRAINT "venture_state_revisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venture_state_revisions" ADD CONSTRAINT "venture_state_revisions_constitution_revision_id_venture_constitution_revisions_id_fk" FOREIGN KEY ("constitution_revision_id") REFERENCES "public"."venture_constitution_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venture_state_revisions" ADD CONSTRAINT "venture_state_revisions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venture_context_projections" ADD CONSTRAINT "venture_context_projections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venture_context_projections" ADD CONSTRAINT "venture_context_projections_constitution_revision_id_venture_constitution_revisions_id_fk" FOREIGN KEY ("constitution_revision_id") REFERENCES "public"."venture_constitution_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venture_context_projections" ADD CONSTRAINT "venture_context_projections_venture_state_revision_id_venture_state_revisions_id_fk" FOREIGN KEY ("venture_state_revision_id") REFERENCES "public"."venture_state_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "venture_context_projections" ADD CONSTRAINT "venture_context_projections_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_state_revisions_company_version_uq" ON "venture_state_revisions" USING btree ("company_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_state_revisions_one_current_per_company_uq" ON "venture_state_revisions" USING btree ("company_id") WHERE "venture_state_revisions"."status" = 'current';
--> statement-breakpoint
CREATE INDEX "venture_state_revisions_company_created_idx" ON "venture_state_revisions" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_context_projections_company_version_uq" ON "venture_context_projections" USING btree ("company_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX "venture_context_projections_one_current_per_company_uq" ON "venture_context_projections" USING btree ("company_id") WHERE "venture_context_projections"."status" = 'current';
--> statement-breakpoint
CREATE INDEX "venture_context_projections_company_created_idx" ON "venture_context_projections" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "venture_context_projections_state_idx" ON "venture_context_projections" USING btree ("venture_state_revision_id");
