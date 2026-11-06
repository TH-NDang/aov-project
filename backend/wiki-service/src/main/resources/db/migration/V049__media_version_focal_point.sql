-- The point of a picture that matters most, usually a face, as fractions of its width and height from the top left.
-- A place that crops the picture to a fixed shape keeps this point in view.
ALTER TABLE media.media_asset_version
    ADD COLUMN focal_x DOUBLE PRECISION,
    ADD COLUMN focal_y DOUBLE PRECISION,
    ADD CONSTRAINT media_asset_version_focal_point_check CHECK (
        (focal_x IS NULL AND focal_y IS NULL)
        OR (focal_x BETWEEN 0 AND 1 AND focal_y BETWEEN 0 AND 1)
    );
