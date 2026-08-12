CREATE TABLE `participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_code` text NOT NULL,
	`bib_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`category` text NOT NULL,
	`chip_id` text,
	`status` text DEFAULT 'REGISTERED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`assigned_at` text,
	`verified_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_registration_code_unique` ON `participants` (`registration_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_bib_number_unique` ON `participants` (`bib_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_chip_id_unique` ON `participants` (`chip_id`);--> statement-breakpoint
CREATE INDEX `participants_status_idx` ON `participants` (`status`);--> statement-breakpoint
CREATE TABLE `verification_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chip_id` text NOT NULL,
	`participant_id` integer,
	`result` text NOT NULL,
	`device_id` text DEFAULT 'UNKNOWN' NOT NULL,
	`scanned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `verification_logs_chip_idx` ON `verification_logs` (`chip_id`);