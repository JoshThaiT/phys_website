CREATE TABLE "booking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"service_slug" text NOT NULL,
	"practitioner" text,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"preferred" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text,
	"consent_at" timestamp with time zone NOT NULL,
	"source_hash" text NOT NULL,
	"idempotency_key" text,
	"purge_after" timestamp with time zone NOT NULL,
	"contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "booking_requests_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "booking_requests_status_created" ON "booking_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "booking_requests_purge" ON "booking_requests" USING btree ("purge_after");--> statement-breakpoint
CREATE INDEX "booking_requests_source_window" ON "booking_requests" USING btree ("source_hash","created_at");