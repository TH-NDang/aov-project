package com.wikiaov.terminology.internal.reference.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.RulesetReference;
import com.wikiaov.platform.ReadModelCache;
import com.wikiaov.terminology.internal.application.response.AdminReferenceCatalogView;
import java.util.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class AdminReferenceCatalogTest {
    @Test
    void normalizesOptionalAndUnknownRulesetsBeforeCacheAndLoader() {
        var contexts = mock(GameplayContexts.class);
        var loader = mock(AdminReferenceCatalogLoader.class);
        var cache = mock(ReadModelCache.class);
        UUID standard = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        when(contexts.rulesets()).thenReturn(List.of(new RulesetReference(other, "alternate"),
                new RulesetReference(standard, "aov-standard")));
        when(cache.read(eq(ReadModelCache.Area.ADMIN_REFERENCES), anyString(), eq(AdminReferenceCatalogView.class),
                any()))
                .thenAnswer(call -> call.<Supplier<AdminReferenceCatalogView>>getArgument(3).get());
        var standardResult = new AdminReferenceCatalogView(standard, List.of());
        var otherResult = new AdminReferenceCatalogView(other, List.of());
        when(loader.read(standard)).thenReturn(standardResult);
        when(loader.read(other)).thenReturn(otherResult);
        var catalog = new AdminReferenceCatalog(contexts, loader, cache);
        assertThat(catalog.read(null)).isEqualTo(standardResult);
        assertThat(catalog.read(UUID.randomUUID())).isEqualTo(standardResult);
        assertThat(catalog.read(other)).isEqualTo(otherResult);
        verify(cache, times(2)).read(eq(ReadModelCache.Area.ADMIN_REFERENCES), eq(standard.toString()),
                eq(AdminReferenceCatalogView.class), any());
        verify(cache).read(eq(ReadModelCache.Area.ADMIN_REFERENCES), eq(other.toString()),
                eq(AdminReferenceCatalogView.class), any());
    }

    @Test
    void emptyRulesetsReturnEmptyWithoutReadingCacheOrProviders() {
        var contexts = mock(GameplayContexts.class);
        var loader = mock(AdminReferenceCatalogLoader.class);
        var cache = mock(ReadModelCache.class);
        when(contexts.rulesets()).thenReturn(List.of());
        var result = new AdminReferenceCatalog(contexts, loader, cache).read(null);
        assertThat(result.rulesetId()).isNull();
        assertThat(result.items()).isEmpty();
        verifyNoInteractions(loader, cache);
    }
}
