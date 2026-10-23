package com.wikiaov.media.internal.domain.model;

import com.wikiaov.media.internal.ingestion.domain.image.ImageFormat;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Object key layout in the media bucket.
 *
 * <pre>
 * incoming/{uploadId}                      direct uploads waiting for validation (never public)
 * imports/...                              objects placed by import tooling (never public)
 * assets/{assetId}/{versionId}.{ext}       validated, immutable bytes; served as /media/{assetId}/{versionId}.{ext}
 * </pre>
 */
public final class MediaObjectKeys {

    /** Name of the only configured storage; kept in the database so a second storage can be added later. */
    public static final String STORAGE_ALIAS = "primary";
    public static final String ASSETS_PREFIX = "assets/";
    public static final String INCOMING_PREFIX = "incoming/";
    public static final String IMPORTS_PREFIX = "imports/";

    private static final int MAX_KEY_LENGTH = 1024;
    private static final Pattern IMPORT_KEY = Pattern.compile("imports/[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*");

    private MediaObjectKeys() {
    }

    public static String incoming(UUID uploadId) {
        return INCOMING_PREFIX + uploadId;
    }

    public static String asset(UUID assetId, UUID versionId, ImageFormat format) {
        return ASSETS_PREFIX + assetId + "/" + versionId + "." + format.extension();
    }

    /** Import keys come from trusted tooling but are still limited to {@code imports/} and safe characters. */
    public static boolean isAllowedImportKey(String key) {
        if (key.length() > MAX_KEY_LENGTH || !IMPORT_KEY.matcher(key).matches()) {
            return false;
        }
        for (String segment : key.split("/")) {
            if (segment.equals(".") || segment.equals("..")) {
                return false;
            }
        }
        return true;
    }
}
