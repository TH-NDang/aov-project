-- Community page IDs are soft references across service boundaries, not database foreign keys.
ALTER TABLE media.media_provenance
    ADD COLUMN owner_page_id uuid,
    ADD COLUMN related_page_id uuid,
    ADD COLUMN reference_version bigint NOT NULL DEFAULT 0;

ALTER TABLE media.media_upload_session
    ADD COLUMN source_owner_page_id uuid,
    ADD COLUMN source_related_page_id uuid;
