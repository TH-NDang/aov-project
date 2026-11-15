package com.wikiaov.media.internal.source.domain;

import java.text.Normalizer;
import java.util.Optional;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * Relative paths of source files inside a collection (02, ADR-030 section).
 *
 * <p>Paths keep the folder and file name the file was collected under. They are never object keys, but the sync tool
 * writes them to local disks, so they must not escape the target folder or carry names Windows cannot store.
 */
public final class SourcePaths {

    public static final int MAX_LENGTH = 512;

    private static final Pattern FORBIDDEN = Pattern.compile("[\\\\:*?\"<>|\\p{Cntrl}\\p{Cf}]");

    private SourcePaths() {
    }

    /** Returns the NFC form of {@code path}, or empty when it breaks the path rules. */
    public static Optional<String> normalize(@Nullable String path) {
        if (path == null) {
            return Optional.empty();
        }

        String normalized = Normalizer.normalize(path, Normalizer.Form.NFC);
        if (normalized.isEmpty() || normalized.length() > MAX_LENGTH || normalized.startsWith("/")
                || FORBIDDEN.matcher(normalized).find()) {
            return Optional.empty();
        }
        for (String segment : normalized.split("/", -1)) {
            if (!validSegment(segment)) {
                return Optional.empty();
            }
        }

        return Optional.of(normalized);
    }

    /** A folder prefix such as {@code raw/shop}: the same rules as a path, without a trailing slash. */
    public static Optional<String> normalizeFolder(@Nullable String folder) {
        if (folder == null) {
            return Optional.empty();
        }
        String trimmed = folder.endsWith("/") ? folder.substring(0, folder.length() - 1) : folder;
        return normalize(trimmed);
    }

    /** The last segment, used as the download name. */
    public static String fileName(String path) {
        int slash = path.lastIndexOf('/');
        return slash < 0 ? path : path.substring(slash + 1);
    }

    private static boolean validSegment(String segment) {
        return !segment.isEmpty() && !segment.equals(".") && !segment.equals("..") && !segment.isBlank()
        // Windows silently drops a trailing dot or space, so two paths could land on one file.
                && !segment.endsWith(".") && !segment.endsWith(" ");
    }
}
