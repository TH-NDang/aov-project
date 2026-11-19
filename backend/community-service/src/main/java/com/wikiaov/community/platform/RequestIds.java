package com.wikiaov.community.platform;

import jakarta.servlet.http.HttpServletRequest;
import org.jspecify.annotations.Nullable;

/**
 * Server-generated request id. It is returned in the {@code X-Request-Id} header and included in every error body
 * and log line. A value sent by the client is never trusted.
 */
public final class RequestIds {
    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "requestId";
    public static final String ATTRIBUTE = RequestIds.class.getName() + ".requestId";

    private RequestIds() {
    }

    /** Request id of an HTTP request, or {@code null} if the request id filter did not run. */
    public static @Nullable String current(HttpServletRequest request) {
        Object value = request.getAttribute(ATTRIBUTE);
        return value != null ? value.toString() : null;
    }
}
