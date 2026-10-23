package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.arcana.internal.catalog.application.ArcanaCatalog;
import com.wikiaov.enchantment.internal.catalog.application.EnchantmentCatalog;
import com.wikiaov.item.internal.catalog.application.ItemCatalog;
import com.wikiaov.spell.internal.catalog.application.SpellCatalog;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;

class CatalogFacadeBoundaryTest {
    @ParameterizedTest
    @ValueSource(classes = {ItemCatalog.class, ArcanaCatalog.class, EnchantmentCatalog.class, SpellCatalog.class})
    void retainsAuthorizationAndTransactionBoundariesOnPublicFacade(Class<?> catalog) throws Exception {
        assertThat(catalog.getAnnotation(Transactional.class)).isNotNull();
        assertThat(catalog.getAnnotation(Transactional.class).readOnly()).isFalse();
        var list = catalog.getMethod("list", UUID.class, String.class, String.class, int.class, int.class,
                UUID.class, UUID.class, boolean.class);
        assertThat(list.getAnnotation(PreAuthorize.class).value()).isEqualTo("hasAuthority('catalog:read')");
        assertThat(list.getAnnotation(Transactional.class).readOnly()).isTrue();
        var published = catalog.getMethod("published", String.class, String.class, int.class, int.class);
        assertThat(published.getAnnotation(Transactional.class).readOnly()).isTrue();
        assertThat(published.getAnnotation(PreAuthorize.class)).isNull();
        var discard = java.util.Arrays.stream(catalog.getMethods())
                .filter(method -> method.getName().equals("discard")).findFirst().orElseThrow();
        String domain = catalog.getSimpleName().replace("Catalog", "").toLowerCase(java.util.Locale.ROOT);
        assertThat(discard.getAnnotation(PreAuthorize.class).value()).isEqualTo("hasAuthority('" + domain + ":write')");
    }
}
