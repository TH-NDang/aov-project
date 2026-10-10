package com.wikiaov.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Whitelist and cardinality check for the query string. {@code @RequestParam} alone does not reject
 * unknown parameters (e.g. a typo {@code ?regoin=VN}) or repeated ones ({@code ?page=1&page=2}).
 */
public final class QueryParameters {

    private QueryParameters() {
    }

    public static void requireOnly(HttpServletRequest request, Set<String> allowed) {
        for (Map.Entry<String, String[]> entry : request.getParameterMap().entrySet()) {
            String name = entry.getKey();
            if (!allowed.contains(name)) {
                throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                        "Query parameter '" + name + "' is not supported.",
                        List.of(new ApiFieldError(name, "UNKNOWN_PARAMETER", "Parameter is not supported.")));
            }
            if (entry.getValue().length > 1) {
                throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                        "Query parameter '" + name + "' must appear at most once.",
                        List.of(new ApiFieldError(name, "REPEATED_PARAMETER", "Parameter must appear once.")));
            }
        }
    }
}
