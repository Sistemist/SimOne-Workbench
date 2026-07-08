ALTER TABLE "cost_events" ADD COLUMN "model_route_decision_id" uuid;
--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_model_route_decision_id_model_route_decisions_id_fk" FOREIGN KEY ("model_route_decision_id") REFERENCES "public"."model_route_decisions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "cost_events_company_model_route_decision_idx" ON "cost_events" USING btree ("company_id","model_route_decision_id");
