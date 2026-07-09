ALTER TABLE "model_route_decisions" DROP CONSTRAINT "model_route_decisions_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ALTER COLUMN "agent_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" DROP CONSTRAINT "model_route_decisions_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
