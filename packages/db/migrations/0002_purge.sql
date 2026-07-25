ALTER TABLE "admin_audit" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit" ALTER COLUMN "reference" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD COLUMN "deleted_unactioned" integer;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD COLUMN "deleted_actioned" integer;