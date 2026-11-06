-- Null means the user never chose, so existing profiles do not change what they see.
ALTER TABLE user_profile.profile
    ADD COLUMN currency VARCHAR(3) CHECK (currency ~ '^[A-Z]{3}$');
