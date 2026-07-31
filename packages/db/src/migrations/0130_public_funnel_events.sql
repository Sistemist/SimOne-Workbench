CREATE TABLE "public_funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"visitor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"path" text NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"referrer_host" text,
	"result_category" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "public_funnel_events_event_key_unique" ON "public_funnel_events" USING btree ("event_key");
--> statement-breakpoint
CREATE INDEX "public_funnel_events_created_at_idx" ON "public_funnel_events" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "public_funnel_events_name_created_idx" ON "public_funnel_events" USING btree ("event_name","created_at");
--> statement-breakpoint
CREATE INDEX "public_funnel_events_visitor_created_idx" ON "public_funnel_events" USING btree ("visitor_id","created_at");
