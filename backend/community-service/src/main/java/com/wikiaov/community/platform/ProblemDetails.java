package com.wikiaov.community.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.ProblemDetail;

/**
 * Builds a ProblemDetail following the error contract shared with wiki-service: RFC 9457 plus {@code code},
 * {@code requestId} and {@code errors}. Module context stays top-level (see {@link ApiException}). Shared by the MVC
 * exception handler, the error controller and the security handlers, so every error has the same shape.
 */
public final class ProblemDetails {
    private ProblemDetails() {
    }

    public static ProblemDetail of(ApiErrorCode code, String detail, HttpServletRequest request) {
        return of(code, detail, List.of(), Map.of(), request);
    }

    public static ProblemDetail of(ApiErrorCode code, String detail, List<ApiFieldError> errors,
            Map<String, Object> context, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(code.status(), detail);
        problem.setTitle(code.title());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code.name());
        String requestId = RequestIds.current(request);
        if (requestId != null) {
            problem.setProperty("requestId", requestId);
        }
        if (!errors.isEmpty()) {
            problem.setProperty("errors", errors);
        }
        context.forEach(problem::setProperty);
        return problem;
    }
}
