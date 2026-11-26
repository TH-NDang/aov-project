package com.wikiaov.community.platform.internal.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.PathContainer;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.ShallowEtagHeaderFilter;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

/**
 * Lets a browser keep the public reads of published competitions for a minute and then ask again by a tag of the
 * answer, which comes back as 304 while nothing was published (spec 03, cache of public reads). These answers are the
 * same for every reader, signed in or not; an error keeps the {@code no-store} its handler sets.
 */
@Component
class PublicReadCacheFilter extends ShallowEtagHeaderFilter {
    static final CacheControl PUBLIC = CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic().mustRevalidate();

    private static final List<PathPattern> PATHS = List.of(
            "/api/community/{version}/competitions",
            "/api/community/{version}/competitions/participants",
            "/api/community/{version}/competitions/{id}",
            "/api/community/{version}/catalog",
            "/api/community/{version}/tournaments",
            "/api/community/{version}/series",
            "/api/community/{version}/games",
            "/api/community/{version}/games/{id}").stream().map(PathPatternParser.defaultInstance::parse).toList();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"GET".equals(request.getMethod())) {
            return true;
        }
        var path = PathContainer.parsePath(request.getRequestURI().substring(request.getContextPath().length()));
        return PATHS.stream().noneMatch(pattern -> pattern.matches(path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        super.doFilterInternal(request, response, (req, res) -> {
            chain.doFilter(req, res);
            // The body is still held here, so the header goes out with it; Spring Security's no-store default then
            // leaves it as it is. An error keeps what its handler set.
            var answer = (HttpServletResponse) res;
            if (answer.getStatus() >= 200 && answer.getStatus() < 300
                    && !answer.containsHeader(HttpHeaders.CACHE_CONTROL)) {
                answer.setHeader(HttpHeaders.CACHE_CONTROL, PUBLIC.getHeaderValue());
            }
        });
    }
}
