package com.wikiaov.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.MDC;

/**
 * Server-generated request id. It is returned in the {@code X-Request-Id} header, included in every error
 * body and log line, and stored with audit records. A value sent by the client is never trusted.
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

    /** Request id of the current thread, for code without access to the request (e.g. audit). */
    public static Optional<UUID> current() {
        String value = MDC.get(MDC_KEY);
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(value));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
