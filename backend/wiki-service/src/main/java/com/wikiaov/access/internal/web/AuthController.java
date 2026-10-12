package com.wikiaov.access.internal.web;

import com.wikiaov.access.internal.application.AuthErrorCode;
import com.wikiaov.access.internal.application.AuthProperties;
import com.wikiaov.access.internal.application.AuthSessions;
import com.wikiaov.access.internal.application.AuthThrottle;
import com.wikiaov.access.internal.application.GoogleLoginFlows;
import com.wikiaov.access.internal.application.port.IdentityTokens;
import com.wikiaov.access.internal.application.response.AuthTokenResponse;
import com.wikiaov.access.internal.web.request.LoginRequest;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Duration;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Cookie-backed auth endpoints use an exact origin and a mandatory non-simple header for CSRF defense. */
@RestController
@RequestMapping(ApiPaths.ROOT + "/auth")
public class AuthController {
    private static final String REFRESH_COOKIE = "aov_admin_refresh";
    private static final String COOKIE_PATH = "/api/wiki/";
    private final AuthProperties properties;
    private final AuthSessions sessions;
    private final IdentityTokens identity;
    private final AuthThrottle throttle;
    private final GoogleLoginFlows googleFlows;

    public AuthController(AuthProperties properties, AuthSessions sessions, IdentityTokens identity,
            AuthThrottle throttle, GoogleLoginFlows googleFlows) {
        this.properties = properties;
        this.sessions = sessions;
        this.identity = identity;
        this.throttle = throttle;
        this.googleFlows = googleFlows;
    }

    @GetMapping(path = "/config", version = "1")
    Map<String, Boolean> config(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return Map.of("googleEnabled", properties.googleEnabled() && !properties.clientSecret().isBlank());
    }

    @PostMapping(path = "/login", version = "1")
    AuthTokenResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request,
            HttpServletResponse response) {
        guard(request);
        throttle.check("login-ip:" + request.getRemoteAddr(), 30);
        throttle.check("login-user:" + body.username().trim().toLowerCase(Locale.ROOT), 10);
        return accept(sessions.password(body.username().trim(), body.password()), response);
    }

    @PostMapping(path = "/refresh", version = "1")
    AuthTokenResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        guard(request);
        String refreshToken = cookie(request, REFRESH_COOKIE);
        if (refreshToken == null)
            throw new ApiException(AuthErrorCode.AUTH_SESSION_EXPIRED, "No active session.");
        throttle.check("refresh-ip:" + request.getRemoteAddr(), 120);
        try {
            return accept(sessions.refresh(refreshToken), response);
        } catch (ApiException exception) {
            if (exception.getErrorCode().status().value() == 401 || exception.getErrorCode().status().value() == 403) {
                setCookie(response, REFRESH_COOKIE, "", 0);
            }
            throw exception;
        }
    }

    @PostMapping(path = "/logout", version = "1")
    ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        guard(request);
        String refreshToken = cookie(request, REFRESH_COOKIE);
        if (refreshToken != null)
            identity.revoke(refreshToken);
        // Preserve the cookie on upstream failure so the user can retry revocation.
        setCookie(response, REFRESH_COOKIE, "", 0);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(path = "/google", version = "1")
    Map<String, String> google(HttpServletRequest request, HttpServletResponse response) {
        guard(request);
        if (!properties.googleEnabled())
            throw new ApiException(AuthErrorCode.AUTH_GOOGLE_DISABLED, "Google login is not configured.");
        if (properties.clientSecret().isBlank())
            throw new ApiException(AuthErrorCode.AUTH_PROVIDER_UNAVAILABLE, "Authentication is not configured.");
        throttle.check("google-ip:" + request.getRemoteAddr(), 10);
        var flow = googleFlows.start();
        setCookie(response, "aov_oauth_" + flow.state(), flow.binding(), 300);
        return Map.of("state", flow.state(), "authorizationUrl",
                identity.authorizationUrl(flow.state(), flow.challenge(), properties.callbackUri()));
    }

    @GetMapping(path = "/google/callback", version = "1")
    ResponseEntity<Void> callback(@RequestParam String state,
            @RequestParam(required = false) String code, @RequestParam(required = false) String error,
            HttpServletRequest request, HttpServletResponse response) {
        QueryParameters.requireOnly(request,
                Set.of("state", "code", "error", "error_description", "session_state", "iss"));
        if (!state.matches("[A-Za-z0-9_-]{43}"))
            throw new ApiException(AuthErrorCode.AUTH_INVALID_STATE, "Invalid login state.");
        var flow = googleFlows.consume(state, cookie(request, "aov_oauth_" + state));
        setCookie(response, "aov_oauth_" + state, "", 0);
        String outcome = "success";
        if (error != null || code == null) {
            outcome = "cancelled";
        } else {
            try {
                accept(sessions.code(code, flow.verifier(), properties.callbackUri()), response);
            } catch (ApiException exception) {
                outcome = exception.getErrorCode().name();
            }
        }
        return ResponseEntity.status(303).location(URI.create(properties.completionUri()
                + "#state=" + state + "&status=" + outcome)).build();
    }

    private void guard(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        if (!properties.adminOrigin().equals(request.getHeader(HttpHeaders.ORIGIN))
                || !"1".equals(request.getHeader("X-AOV-Auth"))) {
            throw new ApiException(AuthErrorCode.AUTH_ORIGIN_REJECTED, "The request origin is not allowed.");
        }
    }

    private AuthTokenResponse accept(IdentityTokens.Tokens tokens, HttpServletResponse response) {
        setCookie(response, REFRESH_COOKIE, tokens.refreshToken(), tokens.refreshExpiresIn());
        return new AuthTokenResponse(tokens.accessToken(), tokens.expiresIn());
    }

    private void setCookie(HttpServletResponse response, String name, String value, long seconds) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(name, value).httpOnly(true)
                .secure(properties.secureCookies()).sameSite("Lax").path(COOKIE_PATH)
                .maxAge(Duration.ofSeconds(seconds)).build().toString());
    }

    private String cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null)
            return null;
        return Arrays.stream(request.getCookies()).filter(cookie -> name.equals(cookie.getName()))
                .map(jakarta.servlet.http.Cookie::getValue).findFirst().orElse(null);
    }
}
