-- How a person likes dates written, kept with their other preferences so every app follows it.
ALTER TABLE user_profile.profile
    ADD COLUMN date_format VARCHAR(8) NOT NULL DEFAULT 'AUTO' CHECK (date_format IN ('AUTO','DMY','MDY','YMD'));
