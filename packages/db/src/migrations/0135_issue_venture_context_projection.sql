ALTER TABLE "issues" ADD COLUMN "venture_context_projection_id" uuid;
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_venture_context_projection_id_venture_context_projections_id_fk" FOREIGN KEY ("venture_context_projection_id") REFERENCES "public"."venture_context_projections"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "issues_venture_context_projection_idx" ON "issues" USING btree ("company_id","venture_context_projection_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "issues_one_sim_cycle_intervention_uq" ON "issues" USING btree ("company_id","origin_kind","origin_id") WHERE "issues"."origin_kind" = 'sim_cycle_intervention' and "issues"."origin_id" is not null;
