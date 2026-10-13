package com.wikiaov.platform.internal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Admin responses are always {@code Cache-Control: no-store}. Public endpoints set their own cache headers
 * and ETag in the controller, because they need a stable representation (03-API section 51-52).
 */
class CacheControlInterceptor implements HandlerInterceptor {

    private static final Pattern ADMIN_PATH = Pattern.compile("^/api/wiki/[^/]+/(admin|auth|users)(/.*)?$");

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (ADMIN_PATH.matcher(request.getRequestURI()).matches()) {
            response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
        }
        return true;
    }
}
