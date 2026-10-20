CREATE SCHEMA IF NOT EXISTS platform;
CREATE TABLE platform.catalog_cache_epoch (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    epoch BIGINT NOT NULL CHECK (epoch > 0)
);
INSERT INTO platform.catalog_cache_epoch (id, epoch) VALUES (1, 1);
