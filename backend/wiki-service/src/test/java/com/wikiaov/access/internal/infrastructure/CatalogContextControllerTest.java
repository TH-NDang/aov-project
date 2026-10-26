package com.wikiaov.access.internal.infrastructure;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.patch.internal.application.response.CatalogContextView;
import com.wikiaov.patch.internal.context.application.CatalogContexts;
import com.wikiaov.patch.internal.web.CatalogContextController;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = CatalogContextController.class)
@Import({CatalogContextController.class, SecurityConfiguration.class, ProblemAuthenticationEntryPoint.class,
        ProblemAccessDeniedHandler.class, ProblemResponseWriter.class})
@ActiveProfiles("test")
class CatalogContextControllerTest {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    CatalogContexts contexts;

    @MockitoBean
    JwtDecoder decoder;

    @Test
    void servesAvailableScopesPubliclyWithDefaultsAndRevalidation() throws Exception {
        when(contexts.read("VN", "vi-VN")).thenReturn(empty());

        mvc.perform(get("/api/wiki/v1/catalog-context")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-cache, public"))
                .andExpect(jsonPath("$.seasons").isArray()).andExpect(jsonPath("$.current.rulesetId").isString());
        verify(contexts).read("VN", "vi-VN");
    }

    @Test
    void passesAnExplicitMarketAndLanguageAndRejectsUnknownParameters() throws Exception {
        mvc.perform(get("/api/wiki/v1/catalog-context?includeDrafts=true")).andExpect(status().isBadRequest());
        verifyNoInteractions(contexts);
        when(contexts.read("TH", "en-US")).thenReturn(empty());

        mvc.perform(get("/api/wiki/v1/catalog-context?region=TH&locale=en-US")).andExpect(status().isOk());
        verify(contexts).read("TH", "en-US");
        mvc.perform(get("/api/wiki/v2/catalog-context")).andExpect(status().isBadRequest());
    }

    private CatalogContextView empty() {
        return new CatalogContextView(List.of(), List.of(), List.of(),
                new CatalogContextView.Current(UUID.randomUUID(), null, UUID.randomUUID()));
    }
}
