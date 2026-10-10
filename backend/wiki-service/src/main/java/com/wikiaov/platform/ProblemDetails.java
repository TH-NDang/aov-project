package com.wikiaov.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.ProblemDetail;

/**
 * Builds a ProblemDetail following the WikiAOV error contract: RFC 9457 plus {@code code}, {@code requestId},
 * {@code errors} and {@code context}. Shared by the MVC exception handler and the security filter handlers,
 * so every error has the same shape.
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
        if (!context.isEmpty()) {
            problem.setProperty("context", context);
        }
        return problem;
    }
}
