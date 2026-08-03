CREATE TABLE "early_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_key" uuid NOT NULL,
	"founder_name" text NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"use_case" text,
	"source" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "early_access_requests_status_check" CHECK ("early_access_requests"."status" in ('pending', 'invited', 'activated', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "early_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"founder_name" text NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"source" text,
	"token_hash" text NOT NULL,
	"max_ventures" integer DEFAULT 3 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"activated_by_user_id" text,
	"created_by_user_id" text,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "early_access_grants_max_ventures_check" CHECK ("early_access_grants"."max_ventures" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "scanner_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"access_request_id" uuid,
	"owner_user_id" text,
	"company_id" uuid,
	"algorithm_version" text NOT NULL,
	"input_payload" jsonb NOT NULL,
	"result_payload" jsonb NOT NULL,
	"client_saved_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"assigned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "early_access_grants" ADD CONSTRAINT "early_access_grants_request_id_early_access_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."early_access_requests"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "early_access_grants" ADD CONSTRAINT "early_access_grants_activated_by_user_id_user_id_fk" FOREIGN KEY ("activated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "early_access_grants" ADD CONSTRAINT "early_access_grants_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scanner_runs" ADD CONSTRAINT "scanner_runs_access_request_id_early_access_requests_id_fk" FOREIGN KEY ("access_request_id") REFERENCES "public"."early_access_requests"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scanner_runs" ADD CONSTRAINT "scanner_runs_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scanner_runs" ADD CONSTRAINT "scanner_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "early_access_requests_request_key_uq" ON "early_access_requests" USING btree ("request_key");
--> statement-breakpoint
CREATE INDEX "early_access_requests_status_created_idx" ON "early_access_requests" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX "early_access_requests_email_created_idx" ON "early_access_requests" USING btree ("email_normalized","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "early_access_grants_token_hash_uq" ON "early_access_grants" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "early_access_grants_user_idx" ON "early_access_grants" USING btree ("activated_by_user_id","revoked_at");
--> statement-breakpoint
CREATE INDEX "early_access_grants_request_idx" ON "early_access_grants" USING btree ("request_id","created_at");
--> statement-breakpoint
CREATE INDEX "scanner_runs_owner_created_idx" ON "scanner_runs" USING btree ("owner_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "scanner_runs_company_created_idx" ON "scanner_runs" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE INDEX "scanner_runs_request_idx" ON "scanner_runs" USING btree ("access_request_id");
