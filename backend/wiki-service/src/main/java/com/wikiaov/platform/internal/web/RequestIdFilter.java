package com.wikiaov.platform.internal.web;

import com.wikiaov.platform.RequestIds;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Generates a request id per request, exposes it as a request attribute and in the logging MDC, and returns it
 * in {@code X-Request-Id}. Runs before Spring Security so 401/403 responses carry a request id too.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RequestIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // Never trust a request id sent by the client.
        String requestId = UUID.randomUUID().toString();
        request.setAttribute(RequestIds.ATTRIBUTE, requestId);
        response.setHeader(RequestIds.HEADER, requestId);
        MDC.put(RequestIds.MDC_KEY, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            // because Tomcat reuse thread; if not remove, after request use again ID of before request
            MDC.remove(RequestIds.MDC_KEY);
        }
    }
}
