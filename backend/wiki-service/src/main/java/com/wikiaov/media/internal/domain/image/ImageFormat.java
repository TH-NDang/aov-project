package com.wikiaov.media.internal.domain.image;

import java.util.Locale;
import java.util.Optional;

/** Image formats accepted for media versions. */
public enum ImageFormat {
    PNG("image/png", "png"),
    JPEG("image/jpeg", "jpg"),
    WEBP("image/webp", "webp");

    private final String mimeType;
    private final String extension;

    ImageFormat(String mimeType, String extension) {
        this.mimeType = mimeType;
        this.extension = extension;
    }

    public String mimeType() {
        return mimeType;
    }

    /** File extension used in object keys and public URLs, without the dot. */
    public String extension() {
        return extension;
    }

    public static Optional<ImageFormat> fromMimeType(String mimeType) {
        String normalized = mimeType.trim().toLowerCase(Locale.ROOT);
        for (ImageFormat format : values()) {
            if (format.mimeType.equals(normalized)) {
                return Optional.of(format);
            }
        }
        return Optional.empty();
    }
}
