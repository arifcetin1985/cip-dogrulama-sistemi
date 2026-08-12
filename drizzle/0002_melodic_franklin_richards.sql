ALTER TABLE `participants` ADD `gender` text DEFAULT 'ERKEK' NOT NULL;
--> statement-breakpoint
UPDATE `participants`
SET `gender` = 'KADIN'
WHERE LOWER(`first_name`) IN ('ada', 'aslı', 'ayşe', 'ceren', 'deniz', 'derya', 'ece', 'elif', 'ezgi', 'selin', 'yağmur', 'zeynep');
