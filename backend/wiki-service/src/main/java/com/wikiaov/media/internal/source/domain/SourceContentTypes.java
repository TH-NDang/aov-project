package com.wikiaov.media.internal.source.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * File types a source file may have (ADR-030 section 5). Nothing a browser would run as a page or script is accepted:
 * the files are served from the storage origin, but they still must never become HTML or SVG documents.
 */
public final class SourceContentTypes {

    public static final String PNG = "image/png";
    public static final String JPEG = "image/jpeg";
    public static final String WEBP = "image/webp";
    public static final String GIF = "image/gif";
    public static final String JSON = "application/json";
    public static final String CSV = "text/csv";
    public static final String TEXT = "text/plain";
    public static final String MARKDOWN = "text/markdown";
    public static final String ZIP = "application/zip";

    private static final Set<String> ALLOWED = Set.of(PNG, JPEG, WEBP, GIF, JSON, CSV, TEXT, MARKDOWN, ZIP);
    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final byte[] JPEG_SIGNATURE = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};

    /** How many leading bytes {@link #matchesSignature} needs. */
    public static final int SIGNATURE_LENGTH = 12;

    private SourceContentTypes() {
    }

    /** The bare, lower-case type when it is allowed; parameters such as {@code charset} are dropped. */
    public static Optional<String> normalize(@Nullable String contentType) {
        if (contentType == null) {
            return Optional.empty();
        }
        String bare = contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        return ALLOWED.contains(bare) ? Optional.of(bare) : Optional.empty();
    }

    public static boolean isImage(String contentType) {
        return contentType.startsWith("image/");
    }

    /** The header written on stored objects: text gets an explicit UTF-8 charset so browsers show it correctly. */
    public static String storedHeader(String contentType) {
        return contentType.startsWith("text/") || contentType.equals(JSON)
                ? contentType + "; charset=utf-8"
                : contentType;
    }

    /**
     * True when the first bytes fit the declared type. Images and ZIP files have a signature; text types have none,
     * so any bytes are accepted for them.
     */
    public static boolean matchesSignature(String contentType, byte[] head) {
        return switch (contentType) {
            case PNG -> startsWith(head, PNG_SIGNATURE);
            case JPEG -> startsWith(head, JPEG_SIGNATURE);
            case WEBP -> head.length >= 12 && ascii(head, 0, 4).equals("RIFF") && ascii(head, 8, 4).equals("WEBP");
            case GIF -> head.length >= 6 && (ascii(head, 0, 6).equals("GIF87a") || ascii(head, 0, 6).equals("GIF89a"));
            case ZIP -> head.length >= 4 && head[0] == 'P' && head[1] == 'K'
                    && (head[2] == 3 && head[3] == 4 || head[2] == 5 && head[3] == 6);
            default -> true;
        };
    }

    private static boolean startsWith(byte[] head, byte[] signature) {
        return head.length >= signature.length
                && Arrays.equals(head, 0, signature.length, signature, 0, signature.length);
    }

    private static String ascii(byte[] bytes, int offset, int length) {
        return new String(bytes, offset, length, java.nio.charset.StandardCharsets.US_ASCII);
    }
}
