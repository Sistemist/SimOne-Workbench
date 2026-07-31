CREATE TABLE "sim_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"phase" text DEFAULT 'map' NOT NULL,
	"constitution_revision_id" uuid NOT NULL,
	"starting_state_revision_id" uuid,
	"current_state_revision_id" uuid,
	"context_projection_id" uuid,
	"start_reason" text NOT NULL,
	"map_output" jsonb,
	"diagnose_output" jsonb,
	"leverage_output" jsonb,
	"compound_output" jsonb,
	"started_by_user_id" text NOT NULL,
	"paused_reason" text,
	"paused_at" timestamp with time zone,
	"resumed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sim_cycles_status_check" CHECK ("sim_cycles"."status" in ('active', 'paused', 'completed')),
	CONSTRAINT "sim_cycles_phase_check" CHECK ("sim_cycles"."phase" in ('map', 'diagnose', 'leverage', 'compound', 'complete'))
);
--> statement-breakpoint
CREATE TABLE "sim_cycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"type" text NOT NULL,
	"phase" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sim_cycle_events_phase_check" CHECK ("sim_cycle_events"."phase" in ('map', 'diagnose', 'leverage', 'compound', 'complete'))
);
--> statement-breakpoint
ALTER TABLE "sim_cycles" ADD CONSTRAINT "sim_cycles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sim_cycles" ADD CONSTRAINT "sim_cycles_constitution_revision_id_venture_constitution_revisions_id_fk" FOREIGN KEY ("constitution_revision_id") REFERENCES "public"."venture_constitution_revisions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sim_cycles" ADD CONSTRAINT "sim_cycles_starting_state_revision_id_venture_state_revisions_id_fk" FOREIGN KEY ("starting_state_revision_id") REFERENCES "public"."venture_state_revisions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sim_cycles" ADD CONSTRAINT "sim_cycles_current_state_revision_id_venture_state_revisions_id_fk" FOREIGN KEY ("current_state_revision_id") REFERENCES "public"."venture_state_revisions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sim_cycles" ADD CONSTRAINT "sim_cycles_context_projection_id_venture_context_projections_id_fk" FOREIGN KEY ("context_projection_id") REFERENCES "public"."venture_context_projections"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sim_cycle_events" ADD CONSTRAINT "sim_cycle_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sim_cycle_events" ADD CONSTRAINT "sim_cycle_events_cycle_id_sim_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."sim_cycles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "sim_cycles_one_open_per_company_uq" ON "sim_cycles" USING btree ("company_id") WHERE "sim_cycles"."status" in ('active', 'paused');
--> statement-breakpoint
CREATE INDEX "sim_cycles_company_created_idx" ON "sim_cycles" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "sim_cycle_events_cycle_created_idx" ON "sim_cycle_events" USING btree ("cycle_id","created_at");
--> statement-breakpoint
CREATE INDEX "sim_cycle_events_company_created_idx" ON "sim_cycle_events" USING btree ("company_id","created_at");
