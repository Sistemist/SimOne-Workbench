CREATE TABLE "company_venture_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by_user_id" text,
	"snapshot" jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_venture_shares" ADD CONSTRAINT "company_venture_shares_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "company_venture_shares_company_created_idx" ON "company_venture_shares" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "company_venture_shares_public_active_idx" ON "company_venture_shares" USING btree ("id","revoked_at");
