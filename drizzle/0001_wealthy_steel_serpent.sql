ALTER TABLE `memory_items` ADD `original_url` text;--> statement-breakpoint
ALTER TABLE `memory_items` ADD `canonical_url` text;--> statement-breakpoint
ALTER TABLE `memory_items` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `memory_items` ADD `author` text;--> statement-breakpoint
ALTER TABLE `memory_items` ADD `site_name` text;--> statement-breakpoint
ALTER TABLE `memory_items` ADD `duplicate_of_id` integer;--> statement-breakpoint
ALTER TABLE `memory_items` ADD `processing_error` text;--> statement-breakpoint
ALTER TABLE `memory_items` ADD `ai_provider` text;--> statement-breakpoint
CREATE UNIQUE INDEX `memory_items_canonical_url_idx` ON `memory_items` (`canonical_url`);--> statement-breakpoint
CREATE INDEX `memory_items_content_hash_idx` ON `memory_items` (`content_hash`);--> statement-breakpoint
CREATE INDEX `memory_items_status_idx` ON `memory_items` (`status`);