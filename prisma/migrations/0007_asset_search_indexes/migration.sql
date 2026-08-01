-- Prefix indexes used by the async Asset selector (code already has a unique index).
CREATE INDEX `assets_name_idx` ON `assets` (`name`);
CREATE INDEX `assets_location_idx` ON `assets` (`location`);
