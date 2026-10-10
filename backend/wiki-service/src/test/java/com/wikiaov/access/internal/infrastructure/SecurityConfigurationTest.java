package com.wikiaov.access.internal.infrastructure;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.access.Capabilities;
import com.wikiaov.platform.ApiPaths;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Access matrix and API versioning, through the real security filter chain and MVC configuration. */
@WebMvcTest(controllers = {SecurityConfigurationTest.PublicProbe.class, SecurityConfigurationTest.AdminProbe.class})
@Import({SecurityConfiguration.class, ProblemAuthenticationEntryPoint.class, ProblemAccessDeniedHandler.class,
        ProblemResponseWriter.class, SecurityConfigurationTest.PublicProbe.class,
        SecurityConfigurationTest.AdminProbe.class})
@ActiveProfiles("test")
class SecurityConfigurationTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void publicReadIsOpenToAnonymousCallers() throws Exception {
        mvc.perform(get("/api/wiki/v1/probe")).andExpect(status().isOk());
    }

    @Test
    void unsupportedApiVersionIsRejected() throws Exception {
        mvc.perform(get("/api/wiki/v2/probe"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_API_VERSION"));
    }

    @Test
    void anonymousWriteIsUnauthenticated() throws Exception {
        mvc.perform(post("/api/wiki/v1/probe"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void adminApiRequiresAuthenticationForEveryVersion() throws Exception {
        for (String version : new String[] {"v1", "v2"}) {
            mvc.perform(get("/api/wiki/" + version + "/admin/probe"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, startsWith("Bearer")))
                    .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                    .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                    .andExpect(jsonPath("$.title").value("Unauthenticated"))
                    .andExpect(jsonPath("$.requestId").isNotEmpty());
        }
    }

    @Test
    void adminApiRequiresCatalogRead() throws Exception {
        mvc.perform(get("/api/wiki/v1/admin/probe").with(jwt()))
                .andExpect(status().isForbidden())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, containsString("insufficient_scope")))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mvc.perform(get("/api/wiki/v1/admin/probe").with(jwt().authorities(authority(Capabilities.CATALOG_READ))))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
    }

    @Test
    void useCaseCapabilityDenialIsForbiddenNotInternalError() throws Exception {
        mvc.perform(post("/api/wiki/v1/admin/probe/publish")
                .with(jwt().authorities(authority(Capabilities.CATALOG_READ))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mvc.perform(post("/api/wiki/v1/admin/probe/publish")
                .with(jwt().authorities(authority(Capabilities.CATALOG_READ),
                        authority(Capabilities.HERO_PUBLISH))))
                .andExpect(status().isOk());
    }

    private static SimpleGrantedAuthority authority(String capability) {
        return new SimpleGrantedAuthority(capability);
    }

    @RestController
    static class PublicProbe {

        @GetMapping(path = ApiPaths.ROOT + "/probe", version = "1")
        String read() {
            return "public";
        }

        @PostMapping(path = ApiPaths.ROOT + "/probe", version = "1")
        String write() {
            return "must not be reachable";
        }
    }

    @RestController
    static class AdminProbe {

        @GetMapping(path = ApiPaths.ADMIN + "/probe", version = "1")
        String read() {
            return "admin";
        }

        @PostMapping(path = ApiPaths.ADMIN + "/probe/publish", version = "1")
        @PreAuthorize("hasAuthority('hero:publish')")
        String publish() {
            return "published";
        }
    }
}
