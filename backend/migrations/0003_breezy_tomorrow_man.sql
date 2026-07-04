CREATE TABLE `reconciliation_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_ref` text NOT NULL,
	`method` text NOT NULL,
	`matched_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reconciliation_matches_payment_ref_unique` ON `reconciliation_matches` (`payment_ref`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `starts_at` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `ends_at` integer;--> statement-breakpoint
ALTER TABLE `donations` ADD `method` text DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `rounded_up` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `gift_aid` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `show_on_wall` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `donations` ADD `receipt_channel` text;--> statement-breakpoint
ALTER TABLE `donations` ADD `receipt_to` text;--> statement-breakpoint
ALTER TABLE `donations` ADD `receipt_sent_at` integer;--> statement-breakpoint
UPDATE `user` SET `role` = 'auditor' WHERE `role` = 'viewer';--> statement-breakpoint
UPDATE `user` SET `role` = 'volunteer' WHERE `role` = 'manager';--> statement-breakpoint
UPDATE `user` SET `username` = 'auditor', `display_username` = 'auditor', `email` = 'auditor@demo.gt' WHERE `username` = 'viewer' AND `email` = 'viewer@demo.gt';--> statement-breakpoint
UPDATE `user` SET `username` = 'volunteer', `display_username` = 'volunteer', `email` = 'volunteer@demo.gt' WHERE `username` = 'manager' AND `email` = 'manager@demo.gt';--> statement-breakpoint
UPDATE `donations` SET `status` = 'completed' WHERE `status` = 'pending';--> statement-breakpoint
UPDATE `donations` SET `status` = 'declined' WHERE `status` = 'failed';--> statement-breakpoint
UPDATE `donations` SET `frequency` = 'one_time', `rounded_up` = 1 WHERE `frequency` = 'roundup';--> statement-breakpoint
UPDATE `donations` SET `method` = 'tap' WHERE `source` = 'kiosk';--> statement-breakpoint
UPDATE `campaigns` SET `frequencies` = replace(replace(replace(`frequencies`, ',"roundup"', ''), '"roundup",', ''), '["roundup"]', '["one_time"]');