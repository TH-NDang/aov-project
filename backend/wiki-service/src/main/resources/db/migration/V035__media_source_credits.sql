ALTER TABLE media.media_provenance
    ADD COLUMN owner_name VARCHAR(200),
    ADD COLUMN contact_url VARCHAR(2048);

ALTER TABLE media.media_upload_session
    ADD COLUMN source_type VARCHAR(32),
    ADD COLUMN source_label VARCHAR(200),
    ADD COLUMN source_url VARCHAR(2048),
    ADD COLUMN source_owner_name VARCHAR(200),
    ADD COLUMN source_contact_url VARCHAR(2048),
    ADD COLUMN source_observed_at TIMESTAMPTZ,
    ADD COLUMN source_note VARCHAR(2000);
