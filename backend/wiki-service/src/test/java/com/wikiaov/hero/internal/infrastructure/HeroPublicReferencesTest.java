package com.wikiaov.hero.internal.infrastructure;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.application.service.HeroQueries;
import com.wikiaov.media.*;
import java.util.*;
import org.junit.jupiter.api.Test;
class HeroPublicReferencesTest {
    @Test
    void usesPublishedPageHeadAndActualTranslationLocale() {
        var query = mock(HeroQueries.class);
        UUID id = UUID.randomUUID();
        var head = new MediaAssetReference(UUID.randomUUID(), MediaSemanticType.HERO_HEAD, MediaAssetState.ACTIVE,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/png", 128, 128, "/head.png"));
        when(query.list("VN", "en-US", 0, 100, "", null, "code,asc")).thenReturn(Map.of("items",
                List.of(Map.of("id", id, "name", "Airi", "actualLocale", "vi-VN", "head", head)), "totalElements", 1));
        var rows = new HeroPublicReferences(query).references("VN", "en-US");
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().id()).isEqualTo(id);
        assertThat(rows.getFirst().icon()).isEqualTo("/head.png");
        assertThat(rows.getFirst().locale()).isEqualTo("vi-VN");
    }
}
