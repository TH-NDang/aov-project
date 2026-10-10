package com.wikiaov.access.internal.infrastructure;

import com.wikiaov.platform.PlatformErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/** 403 as ProblemDetail, keeping the RFC 6750 {@code WWW-Authenticate: Bearer error="insufficient_scope"}. */
@Component
class ProblemAccessDeniedHandler implements AccessDeniedHandler {

    private final BearerTokenAccessDeniedHandler bearerHandler = new BearerTokenAccessDeniedHandler();
    private final ProblemResponseWriter writer;

    ProblemAccessDeniedHandler(ProblemResponseWriter writer) {
        this.writer = writer;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException exception) throws IOException {
        bearerHandler.handle(request, response, exception);
        writer.write(request, response, PlatformErrorCode.FORBIDDEN,
                "The token does not grant the required permission.");
    }
}
