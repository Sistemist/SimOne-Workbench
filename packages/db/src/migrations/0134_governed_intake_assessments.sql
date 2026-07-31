CREATE TABLE "governed_intake_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_kind" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_version" text NOT NULL,
	"display_name" text NOT NULL,
	"plugin_id" uuid,
	"decision" text NOT NULL,
	"compatibility" text NOT NULL,
	"capability_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"permission_boundary" text NOT NULL,
	"cost_boundary" text NOT NULL,
	"product_boundary" text NOT NULL,
	"review_note" text NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reviewed_by_user_id" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "governed_intake_resource_kind_check" CHECK ("governed_intake_assessments"."resource_kind" in ('plugin', 'paperclip_upstream')),
	CONSTRAINT "governed_intake_decision_check" CHECK ("governed_intake_assessments"."decision" in ('adopt', 'adapt', 'defer', 'reject')),
	CONSTRAINT "governed_intake_compatibility_check" CHECK ("governed_intake_assessments"."compatibility" in ('compatible', 'needs_review', 'incompatible')),
	CONSTRAINT "governed_intake_plugin_link_check" CHECK (("governed_intake_assessments"."resource_kind" = 'plugin' and "governed_intake_assessments"."plugin_id" is not null)
        or ("governed_intake_assessments"."resource_kind" = 'paperclip_upstream' and "governed_intake_assessments"."plugin_id" is null))
);
--> statement-breakpoint
ALTER TABLE "governed_intake_assessments" ADD CONSTRAINT "governed_intake_assessments_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "governed_intake_resource_version_idx" ON "governed_intake_assessments" USING btree ("resource_kind","resource_id","resource_version","created_at");
--> statement-breakpoint
CREATE INDEX "governed_intake_plugin_version_idx" ON "governed_intake_assessments" USING btree ("plugin_id","resource_version","created_at");
