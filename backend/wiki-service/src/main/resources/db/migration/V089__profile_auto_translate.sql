-- Whether Stream translates posts into the reader's language without being asked (ADR-037). Off for everyone until
-- they turn it on.
ALTER TABLE user_profile.profile
    ADD COLUMN auto_translate BOOLEAN NOT NULL DEFAULT false;
