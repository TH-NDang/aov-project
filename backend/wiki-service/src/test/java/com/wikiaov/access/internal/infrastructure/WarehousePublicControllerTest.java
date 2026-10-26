package com.wikiaov.access.internal.infrastructure;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.arcana.internal.catalog.application.ArcanaCatalog;
import com.wikiaov.arcana.internal.web.ArcanaPublicController;
import com.wikiaov.enchantment.internal.application.response.PublicEnchantmentBranchView;
import com.wikiaov.enchantment.internal.catalog.application.EnchantmentCatalog;
import com.wikiaov.enchantment.internal.metadata.application.PublicEnchantmentBranchCatalog;
import com.wikiaov.enchantment.internal.web.EnchantmentBranchPublicController;
import com.wikiaov.enchantment.internal.web.EnchantmentPublicController;
import com.wikiaov.item.internal.application.response.PublicItemCategoryView;
import com.wikiaov.item.internal.catalog.application.ItemCatalog;
import com.wikiaov.item.internal.metadata.application.PublicItemCategoryCatalog;
import com.wikiaov.item.internal.web.ItemCategoryPublicController;
import com.wikiaov.item.internal.web.ItemPublicController;
import com.wikiaov.platform.CatalogText.MetadataTranslation;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.spell.internal.catalog.application.SpellCatalog;
import com.wikiaov.spell.internal.web.SpellPublicController;
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

@WebMvcTest(controllers = {ItemPublicController.class, ArcanaPublicController.class, EnchantmentPublicController.class,
        SpellPublicController.class, ItemCategoryPublicController.class, EnchantmentBranchPublicController.class})
@Import({ItemPublicController.class, ArcanaPublicController.class, EnchantmentPublicController.class,
        SpellPublicController.class, ItemCategoryPublicController.class, EnchantmentBranchPublicController.class,
        SecurityConfiguration.class, ProblemAuthenticationEntryPoint.class, ProblemAccessDeniedHandler.class,
        ProblemResponseWriter.class})
@ActiveProfiles("test")
class WarehousePublicControllerTest {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    ItemCatalog items;

    @MockitoBean
    ArcanaCatalog arcana;

    @MockitoBean
    EnchantmentCatalog enchantments;

    @MockitoBean
    SpellCatalog spells;

    @MockitoBean
    PublicItemCategoryCatalog categories;

    @MockitoBean
    PublicEnchantmentBranchCatalog branches;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void servesPublishedCatalogsAndLocalizedGroupsWithoutAuthentication() throws Exception {
        when(items.published("VN", "vi-VN", 0, 20)).thenReturn(new PageSlice<>(List.of(), 0, 20, 0));
        when(arcana.published("VN", "vi-VN", 0, 20)).thenReturn(new PageSlice<>(List.of(), 0, 20, 0));
        when(enchantments.published("VN", "vi-VN", 0, 20)).thenReturn(new PageSlice<>(List.of(), 0, 20, 0));
        when(spells.published("VN", "vi-VN", 0, 20)).thenReturn(new PageSlice<>(List.of(), 0, 20, 0));
        var text = new MetadataTranslation("vi-VN", "Nhóm", "Mô tả", null);
        when(categories.read("vi-VN"))
                .thenReturn(List.of(new PublicItemCategoryView("cong", 1, "#f00", List.of(text), null, null)));
        when(branches.read("vi-VN"))
                .thenReturn(
                        List.of(new PublicEnchantmentBranchView("vuc-hon-mang", 1, "#f00", List.of(text), null, null)));

        for (var route : List.of("items", "arcana", "enchantments", "spells"))
            mvc.perform(get("/api/wiki/v1/" + route)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/wiki/v1/item-categories")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("cong"))
                .andExpect(jsonPath("$[0].translations[0].locale").value("vi-VN"));
        mvc.perform(get("/api/wiki/v1/enchantment-branches")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("vuc-hon-mang"));
    }

    @Test
    void forwardsOptionalSeasonAndPatchScopesToEveryWarehouseCatalog() throws Exception {
        var season = UUID.randomUUID();
        var patch = UUID.randomUUID();
        when(items.published("VN", "en-US", 0, 20, season, patch, true))
                .thenReturn(new PageSlice<>(List.of(), 0, 20, 0));
        when(arcana.published("VN", "en-US", 0, 20, season, patch, true))
                .thenReturn(new PageSlice<>(List.of(), 0, 20, 0));
        when(enchantments.published("VN", "en-US", 0, 20, season, patch, true))
                .thenReturn(new PageSlice<>(List.of(), 0, 20, 0));
        when(spells.published("VN", "en-US", 0, 20, season, patch, true))
                .thenReturn(new PageSlice<>(List.of(), 0, 20, 0));

        for (var route : List.of("items", "arcana", "enchantments", "spells"))
            mvc.perform(get("/api/wiki/v1/" + route).param("locale", "en-US")
                    .param("seasonId", season.toString()).param("patchVariantId", patch.toString())
                    .param("includeUnscoped", "true")).andExpect(status().isOk())
                    .andExpect(jsonPath("$.items").isEmpty());
        verify(items).published("VN", "en-US", 0, 20, season, patch, true);
        verify(arcana).published("VN", "en-US", 0, 20, season, patch, true);
        verify(enchantments).published("VN", "en-US", 0, 20, season, patch, true);
        verify(spells).published("VN", "en-US", 0, 20, season, patch, true);
        mvc.perform(get("/api/wiki/v1/items").param("includeDrafts", "true")).andExpect(status().isBadRequest());
    }

    @Test
    void whitelistsMetadataQueryParametersAndKeepsAdminProtected() throws Exception {
        mvc.perform(get("/api/wiki/v1/item-categories?includeDrafts=true")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/wiki/v1/enchantment-branches?region=VN")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/wiki/v2/item-categories")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/wiki/v1/admin/item-categories")).andExpect(status().isUnauthorized());

        verifyNoInteractions(categories, branches);
    }
}
