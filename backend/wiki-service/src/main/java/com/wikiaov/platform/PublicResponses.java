package com.wikiaov.platform;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.WebRequest;
import tools.jackson.databind.json.JsonMapper;

/**
 * The cache headers of public reads that answer with what is current (03-API section 51). A browser may reuse such an
 * answer for {@link #FRESH} without asking, as long as the Wiki's own queries consider data fresh; after that it asks
 * again with the entity tag and gets 304 when nothing changed.
 */
public final class PublicResponses {
    /** How long a browser reuses a current public read before it revalidates. */
    public static final Duration FRESH = Duration.ofSeconds(60);

    private PublicResponses() {
    }

    /** {@code public, max-age=60, must-revalidate}. */
    public static CacheControl current() {
        return CacheControl.maxAge(FRESH).cachePublic().mustRevalidate();
    }

    /** The body with its entity tag and {@link #current()}, or 304 when the caller already holds that tag. */
    public static <T> ResponseEntity<T> current(T body, WebRequest request, JsonMapper json) {
        return tagged(body, request, json, current());
    }

    /** The body with its entity tag and the given cache header, or 304 when the caller already holds that tag. */
    public static <T> ResponseEntity<T> tagged(T body, WebRequest request, JsonMapper json, CacheControl cache) {
        String tag;
        try {
            tag = "\"" + HexFormat.of()
                    .formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(body))) + "\"";
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }

        if (request.checkNotModified(tag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(tag).cacheControl(cache).build();
        }
        return ResponseEntity.ok().eTag(tag).cacheControl(cache).body(body);
    }
}
