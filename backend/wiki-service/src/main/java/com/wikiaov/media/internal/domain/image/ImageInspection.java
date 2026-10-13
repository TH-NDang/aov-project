package com.wikiaov.media.internal.domain.image;

/**
 * Facts read from the bytes themselves, never from what the client declared.
 *
 * @param format    format detected from the file signature
 * @param width     width in pixels, from the image header
 * @param height    height in pixels, from the image header
 * @param sizeBytes number of bytes read
 * @param sha256    lowercase hex SHA-256 of all bytes
 */
public record ImageInspection(
        ImageFormat format,
        int width,
        int height,
        long sizeBytes,
        String sha256
) {
}
