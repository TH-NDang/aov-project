-- Images from the user-supplied Figma package are screenshots captured from the game; the package was only how they
-- were delivered. Name the source after where the pictures come from.
UPDATE media.media_provenance
SET source_label = 'Ảnh chụp từ game Liên Quân'
WHERE source_label = 'Ảnh chụp Liên Quân — gói Figma do người dùng cung cấp';

UPDATE media.media_upload_session
SET source_label = 'Ảnh chụp từ game Liên Quân'
WHERE source_label = 'Ảnh chụp Liên Quân — gói Figma do người dùng cung cấp';
