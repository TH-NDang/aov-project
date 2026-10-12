package com.wikiaov.access.internal.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.access.internal.application.AuthErrorCode;
import com.wikiaov.access.internal.application.AuthProperties;
import com.wikiaov.access.internal.application.AuthSessions;
import com.wikiaov.access.internal.application.AuthThrottle;
import com.wikiaov.access.internal.application.GoogleLoginFlows;
import com.wikiaov.access.internal.application.port.IdentityTokens;
import com.wikiaov.access.internal.web.AuthController;
import com.wikiaov.platform.ApiException;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

@WebMvcTest(controllers = AuthController.class)
@Import({AuthController.class, SecurityConfiguration.class, ProblemAuthenticationEntryPoint.class,
        ProblemAccessDeniedHandler.class, ProblemResponseWriter.class, AuthThrottle.class,
        GoogleLoginFlows.class, AuthControllerTest.Config.class})
@ActiveProfiles("test")
class AuthControllerTest {
    @Autowired
    MockMvc mvc;
    @MockitoBean
    JwtDecoder jwtDecoder;
    @MockitoBean
    AuthSessions sessions;
    @MockitoBean
    IdentityTokens identity;

    @TestConfiguration
    static class Config {
        @Bean
        AuthProperties authProperties() {
            return new AuthProperties("http://localhost:5175", "/", "admin-aov-backend", "test-secret",
                    false, true, "/api/wiki/v1/auth/google/callback");
        }
    }

    @Test
    void rejectsCrossOriginAndMissingCsrfHeaderBeforeCallingProvider() throws Exception {
        for (String path : new String[] {"login", "refresh", "logout", "google"}) {
            mvc.perform(post("/api/wiki/v1/auth/" + path).contentType("application/json")
                    .content("{\"username\":\"editor\",\"password\":\"test-password\"}")
                    .header("Origin", "https://untrusted.example").header("X-AOV-Auth", "1"))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/wiki/v1/auth/" + path).contentType("application/json")
                    .content("{\"username\":\"editor\",\"password\":\"test-password\"}")
                    .header("Origin", "http://localhost:5175"))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(sessions, identity);
    }

    @Test
    void passwordLoginKeepsRefreshTokenOutOfJsonAndSetsHttpOnlyCookie() throws Exception {
        when(sessions.password("editor", "test-password")).thenReturn(tokens());
        mvc.perform(authPost("login").contentType("application/json")
                .content("{\"username\":\"editor\",\"password\":\"test-password\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").value("access"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(cookie().httpOnly("aov_admin_refresh", true))
                .andExpect(cookie().path("aov_admin_refresh", "/api/wiki/"))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Lax")))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void invalidCredentialsDoNotSetSessionCookie() throws Exception {
        when(sessions.password("editor", "wrong"))
                .thenThrow(new ApiException(AuthErrorCode.AUTH_INVALID_CREDENTIALS, "Rejected"));
        mvc.perform(authPost("login").contentType("application/json")
                .content("{\"username\":\"editor\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized()).andExpect(cookie().doesNotExist("aov_admin_refresh"));
    }

    @Test
    void refreshRotatesCookieAndExpiredRefreshClearsIt() throws Exception {
        when(sessions.refresh("old-refresh")).thenReturn(tokens());
        mvc.perform(authPost("refresh").cookie(new Cookie("aov_admin_refresh", "old-refresh")))
                .andExpect(status().isOk()).andExpect(cookie().value("aov_admin_refresh", "refresh"));
        when(sessions.refresh("expired")).thenThrow(new ApiException(AuthErrorCode.AUTH_SESSION_EXPIRED, "Expired"));
        mvc.perform(authPost("refresh").cookie(new Cookie("aov_admin_refresh", "expired")))
                .andExpect(status().isUnauthorized()).andExpect(cookie().maxAge("aov_admin_refresh", 0));
        mvc.perform(authPost("refresh")).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesSessionAndDoesNotPretendSuccessOnProviderFailure() throws Exception {
        mvc.perform(authPost("logout").cookie(new Cookie("aov_admin_refresh", "refresh")))
                .andExpect(status().isNoContent()).andExpect(cookie().maxAge("aov_admin_refresh", 0));
        verify(identity).revoke("refresh");
        doThrow(new ApiException(AuthErrorCode.AUTH_PROVIDER_UNAVAILABLE, "Unavailable")).when(identity)
                .revoke("retry");
        mvc.perform(authPost("logout").cookie(new Cookie("aov_admin_refresh", "retry")))
                .andExpect(status().isServiceUnavailable()).andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void googleRequiresBoundStateAndRejectsCallbackReplay() throws Exception {
        when(identity.authorizationUrl(anyString(), anyString(), anyString()))
                .thenReturn("https://identity.example/auth");
        var start = mvc.perform(authPost("google")).andExpect(status().isOk()).andReturn().getResponse();
        String state = JsonMapper.builder().build().readTree(start.getContentAsString()).get("state").asText();
        Cookie binding = start.getCookie("aov_oauth_" + state);
        assertThat(binding).isNotNull();
        mvc.perform(get("/api/wiki/v1/auth/google/callback").param("state", state).param("code", "code"))
                .andExpect(status().isBadRequest());
        when(sessions.code(anyString(), anyString(), anyString())).thenReturn(tokens());
        mvc.perform(
                get("/api/wiki/v1/auth/google/callback").param("state", state).param("code", "code").cookie(binding))
                .andExpect(status().isSeeOther()).andExpect(cookie().httpOnly("aov_admin_refresh", true))
                .andExpect(header().string("Location",
                        "http://localhost:5175/auth/google-complete.html#state=" + state + "&status=success"));
        mvc.perform(
                get("/api/wiki/v1/auth/google/callback").param("state", state).param("code", "code").cookie(binding))
                .andExpect(status().isBadRequest());
    }

    private MockHttpServletRequestBuilder authPost(String path) {
        return post("/api/wiki/v1/auth/" + path).header("Origin", "http://localhost:5175").header("X-AOV-Auth", "1");
    }

    private IdentityTokens.Tokens tokens() {
        return new IdentityTokens.Tokens("access", 300, "refresh", 1800);
    }
}
