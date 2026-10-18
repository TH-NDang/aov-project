ALTER TABLE hero.import_job
    ADD COLUMN notification_dismissed boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT import_job_dismissed_only_when_complete
        CHECK (NOT notification_dismissed OR completed = total);
