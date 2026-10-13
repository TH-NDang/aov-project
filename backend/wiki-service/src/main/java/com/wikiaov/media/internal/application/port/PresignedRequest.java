package com.wikiaov.media.internal.application.port;

import java.net.URI;
import java.time.Instant;
import java.util.Map;

/**
 * A pre-signed HTTP request the client must send exactly as described.
 *
 * @param url       target URL including the signature
 * @param method    HTTP method, e.g. {@code PUT}
 * @param headers   headers the client must send with the request (the signature covers them)
 * @param expiresAt instant after which the URL is rejected
 */
public record PresignedRequest(
        URI url,
        String method,
        Map<String, String> headers,
        Instant expiresAt
) {

    public PresignedRequest {
        headers = Map.copyOf(headers);
    }
}
