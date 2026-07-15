CREATE TABLE `memory_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '手动记录' NOT NULL,
	`kind` text DEFAULT '笔记' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`project` text,
	`color` text DEFAULT 'sage' NOT NULL,
	`glyph` text DEFAULT '记' NOT NULL,
	`status` text DEFAULT 'inbox' NOT NULL,
	`processing_status` text DEFAULT 'ready' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
