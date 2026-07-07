CREATE TABLE "model_route_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"issue_id" uuid,
	"project_id" uuid,
	"goal_id" uuid,
	"heartbeat_run_id" uuid,
	"lane" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"reason" text NOT NULL,
	"risk_level" text DEFAULT 'unknown' NOT NULL,
	"task_intent" text,
	"context_summary" text,
	"approval_gate" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_by_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD CONSTRAINT "model_route_decisions_created_by_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("created_by_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "model_route_decisions_company_created_idx" ON "model_route_decisions" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "model_route_decisions_company_lane_created_idx" ON "model_route_decisions" USING btree ("company_id","lane","created_at");
--> statement-breakpoint
CREATE INDEX "model_route_decisions_company_agent_created_idx" ON "model_route_decisions" USING btree ("company_id","agent_id","created_at");
--> statement-breakpoint
CREATE INDEX "model_route_decisions_company_run_idx" ON "model_route_decisions" USING btree ("company_id","heartbeat_run_id");
