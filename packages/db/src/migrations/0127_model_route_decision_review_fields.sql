ALTER TABLE "model_route_decisions" ADD COLUMN "output_summary" text;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD COLUMN "output_confidence" text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD COLUMN "review_status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "model_route_decisions" ADD COLUMN "review_note" text;
