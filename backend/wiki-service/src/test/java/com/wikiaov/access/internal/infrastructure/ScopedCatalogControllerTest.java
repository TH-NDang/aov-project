package com.wikiaov.access.internal.infrastructure;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.hero.internal.application.response.PublicSkinCatalogView;
import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.skins.application.PublicSkinCatalog;
import com.wikiaov.hero.internal.web.HeroPublicController;
import com.wikiaov.hero.internal.web.PublicSkinCatalogController;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.ReadModelCache;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.domain.ReferenceSettings;
import com.wikiaov.terminology.internal.reference.application.AdminReferenceCatalog;
import com.wikiaov.terminology.internal.reference.application.PublicReferenceCatalog;
import com.wikiaov.terminology.internal.settings.application.ReferenceCatalog;
import com.wikiaov.terminology.internal.web.ReferenceController;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = {HeroPublicController.class, PublicSkinCatalogController.class, ReferenceController.class})
@Import({HeroPublicController.class, PublicSkinCatalogController.class, ReferenceController.class,
        SecurityConfiguration.class, ProblemAuthenticationEntryPoint.class, ProblemAccessDeniedHandler.class,
        ProblemResponseWriter.class})
@ActiveProfiles("test")
class ScopedCatalogControllerTest {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    HeroQueries heroes;

    @MockitoBean
    PublicSkinCatalog skins;

    @MockitoBean
    PublicReferenceCatalog references;

    @MockitoBean
    ReferenceCatalog settings;

    @MockitoBean
    AdminReferenceCatalog authoring;

    @MockitoBean
    ReadModelCache cache;

    @MockitoBean
    JwtDecoder decoder;

    @Test
    void publicHeroSkinAndReferenceReadsShareTheSameExplicitScope() throws Exception {
        var hero = UUID.randomUUID();
        var season = UUID.randomUUID();
        var patch = UUID.randomUUID();
        when(heroes.list("VN", "en-US", 0, 20, "", null, "code,asc", season, patch, false))
                .thenReturn(Map.of("items", List.of()));
        when(heroes.detail(hero, "VN", "en-US", false, season, patch, false))
                .thenReturn(Map.of("id", hero));
        when(heroes.detail(hero, "VN", "en-US", true, season, patch, false))
                .thenReturn(Map.of("id", hero));
        when(skins.read("VN", "en-US", "", null, null, 0, 24, season, patch, false))
                .thenReturn(new PublicSkinCatalogView(new PageSlice<>(List.of(), 0, 24, 0), List.of(), List.of()));
        when(references.read("VN", "en-US", season, patch, false))
                .thenReturn(new ReferenceSettingsView(1, new ReferenceSettings(1, true, "vi-VN", List.of())));

        for (var route : List.of("heroes", "heroes/" + hero, "heroes/" + hero + "/manifest", "skins",
                "reference-catalog"))
            mvc.perform(get("/api/wiki/v1/" + route).param("locale", "en-US")
                    .param("seasonId", season.toString()).param("patchVariantId", patch.toString()))
                    .andExpect(status().isOk());

        verify(heroes).list("VN", "en-US", 0, 20, "", null, "code,asc", season, patch, false);
        verify(heroes).detail(hero, "VN", "en-US", false, season, patch, false);
        verify(heroes).detail(hero, "VN", "en-US", true, season, patch, false);
        verify(skins).read("VN", "en-US", "", null, null, 0, 24, season, patch, false);
        verify(references).read("VN", "en-US", season, patch, false);
    }
}
