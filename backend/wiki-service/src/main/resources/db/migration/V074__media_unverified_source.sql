-- A source is unverified when it was recorded without any evidence of where the image came from, for example the
-- placeholder written when a new version arrives with no source. Until now that state lived only in the label text,
-- and the needsCredit filter matched the words of the label; the flag makes it data, so the wording can change.
ALTER TABLE media.media_provenance
    ADD COLUMN unverified BOOLEAN NOT NULL DEFAULT FALSE;

-- Rows recorded so far are recognised the way the filter recognised them.
UPDATE media.media_provenance
SET unverified = TRUE
WHERE source_label LIKE '%Chưa xác minh%';
