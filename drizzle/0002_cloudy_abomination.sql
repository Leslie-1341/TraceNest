CREATE TABLE `todo_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`due_date` text,
	`due_time` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`calendar_provider` text DEFAULT 'internal' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `todo_items_due_date_idx` ON `todo_items` (`due_date`);--> statement-breakpoint
CREATE INDEX `todo_items_completed_idx` ON `todo_items` (`completed`);