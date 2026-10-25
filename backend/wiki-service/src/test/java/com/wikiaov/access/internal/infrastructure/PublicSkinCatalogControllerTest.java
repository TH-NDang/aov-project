package com.wikiaov.access.internal.infrastructure;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.hero.internal.application.response.PublicSkinCatalogView;
import com.wikiaov.hero.internal.skins.application.PublicSkinCatalog;
import com.wikiaov.hero.internal.web.PublicSkinCatalogController;
import com.wikiaov.platform.PageSlice;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PublicSkinCatalogController.class)
@Import({PublicSkinCatalogController.class, SecurityConfiguration.class, ProblemAuthenticationEntryPoint.class,
        ProblemAccessDeniedHandler.class, ProblemResponseWriter.class})
@ActiveProfiles("test")
class PublicSkinCatalogControllerTest {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    PublicSkinCatalog catalog;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void servesPublishedSkinsPubliclyWithDefaultsAndRevalidation() throws Exception {
        when(catalog.read("VN", "vi-VN", "", null, null, 0, 24))
                .thenReturn(new PublicSkinCatalogView(new PageSlice<>(List.of(), 0, 24, 0), List.of(), List.of()));

        mvc.perform(get("/api/wiki/v1/skins")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-cache, public"))
                .andExpect(jsonPath("$.page.items").isEmpty())
                .andExpect(jsonPath("$.page.size").value(24))
                .andExpect(jsonPath("$.heroes").isEmpty());
    }

    @Test
    void rejectsUnknownParametersBeforeReadingTheCatalog() throws Exception {
        mvc.perform(get("/api/wiki/v1/skins?includeDrafts=true")).andExpect(status().isBadRequest());

        verifyNoInteractions(catalog);
    }

    @Test
    void passesExplicitFiltersAndRejectsUnsupportedVersions() throws Exception {
        when(catalog.read("TW", "en-US", "queen", "diao-chan", "ss-vn-1", 1, 12))
                .thenReturn(new PublicSkinCatalogView(new PageSlice<>(List.of(), 1, 12, 0), List.of(), List.of()));

        mvc.perform(
                get("/api/wiki/v1/skins?region=TW&locale=en-US&q=queen&hero=diao-chan&rarity=ss-vn-1&page=1&size=12"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.page.page").value(1));
        mvc.perform(get("/api/wiki/v2/skins")).andExpect(status().isBadRequest());
    }
}
