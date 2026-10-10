package com.wikiaov.access.internal.infrastructure;

import com.wikiaov.platform.PlatformErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/** 401 as ProblemDetail, keeping the RFC 6750 {@code WWW-Authenticate} header (e.g. error="invalid_token"). */
@Component
class ProblemAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final BearerTokenAuthenticationEntryPoint bearerEntryPoint = new BearerTokenAuthenticationEntryPoint();
    private final ProblemResponseWriter writer;

    ProblemAuthenticationEntryPoint(ProblemResponseWriter writer) {
        this.writer = writer;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException exception) throws IOException {
        bearerEntryPoint.commence(request, response, exception);
        writer.write(request, response, PlatformErrorCode.UNAUTHENTICATED, "A valid bearer token is required.");
    }
}
