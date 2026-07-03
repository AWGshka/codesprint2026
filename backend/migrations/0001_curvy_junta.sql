CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_id_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`cause` text NOT NULL,
	`description` text NOT NULL,
	`story` text,
	`target_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`brand_color` text NOT NULL,
	`logo_url` text,
	`hero_image_url` text,
	`presets_minor` text NOT NULL,
	`allow_custom` integer DEFAULT true NOT NULL,
	`frequencies` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_slug_unique` ON `campaigns` (`slug`);--> statement-breakpoint
CREATE INDEX `campaigns_status_idx` ON `campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `campaigns_slug_idx` ON `campaigns` (`slug`);--> statement-breakpoint
CREATE TABLE `donations` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`campaign_id` text NOT NULL,
	`donor_name` text,
	`donor_email` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`frequency` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`payment_ref` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `donations_reference_unique` ON `donations` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `donations_payment_ref_unique` ON `donations` (`payment_ref`);--> statement-breakpoint
CREATE INDEX `donations_campaign_id_idx` ON `donations` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `donations_status_idx` ON `donations` (`status`);--> statement-breakpoint
CREATE INDEX `donations_currency_idx` ON `donations` (`currency`);--> statement-breakpoint
CREATE INDEX `donations_created_at_idx` ON `donations` (`created_at`);--> statement-breakpoint
CREATE INDEX `donations_payment_ref_idx` ON `donations` (`payment_ref`);--> statement-breakpoint
CREATE TABLE `processor_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_ref` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `processor_settlements_payment_ref_idx` ON `processor_settlements` (`payment_ref`);--> statement-breakpoint
DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "audit_logs_created_at_idx";--> statement-breakpoint
DROP INDEX "audit_logs_actor_id_idx";--> statement-breakpoint
DROP INDEX "audit_logs_action_idx";--> statement-breakpoint
DROP INDEX "campaigns_slug_unique";--> statement-breakpoint
DROP INDEX "campaigns_status_idx";--> statement-breakpoint
DROP INDEX "campaigns_slug_idx";--> statement-breakpoint
DROP INDEX "donations_reference_unique";--> statement-breakpoint
DROP INDEX "donations_payment_ref_unique";--> statement-breakpoint
DROP INDEX "donations_campaign_id_idx";--> statement-breakpoint
DROP INDEX "donations_status_idx";--> statement-breakpoint
DROP INDEX "donations_currency_idx";--> statement-breakpoint
DROP INDEX "donations_created_at_idx";--> statement-breakpoint
DROP INDEX "donations_payment_ref_idx";--> statement-breakpoint
DROP INDEX "processor_settlements_payment_ref_idx";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "user_username_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
ALTER TABLE `account` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL;--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
ALTER TABLE `session` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint
ALTER TABLE `verification` ALTER COLUMN "created_at" TO "created_at" integer NOT NULL;--> statement-breakpoint
ALTER TABLE `verification` ALTER COLUMN "updated_at" TO "updated_at" integer NOT NULL;