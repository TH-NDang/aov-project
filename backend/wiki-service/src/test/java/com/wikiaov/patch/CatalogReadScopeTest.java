package com.wikiaov.patch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogReadScopeTest {
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final Instant now = Instant.parse("2026-10-26T00:00:00Z");
    private final GameplayContext gameplay = new GameplayContext(UUID.randomUUID(), "VN", UUID.randomUUID(),
            "aov-standard", UUID.randomUUID(), "current", UUID.randomUUID(), 3, now);

    @Test
    void currentCatalogAlwaysIncludesUnscopedObservationsThroughTheExistingResolver() {
        when(contexts.resolve("VN", now)).thenReturn(gameplay);

        var result = CatalogReadScope.resolve(contexts, "VN", now, null, null, false);

        assertThat(result.gameplay()).isSameAs(gameplay);
        assertThat(result.allowUnscoped()).isTrue();
        verify(contexts).resolve("VN", now);
        verifyNoMoreInteractions(contexts);
    }

    @Test
    void historicalCatalogIncludesUnscopedObservationsOnlyWhenRequested() {
        var season = UUID.randomUUID();
        var patch = UUID.randomUUID();
        when(contexts.resolveCatalog("VN", now, season, patch)).thenReturn(gameplay);

        assertThat(CatalogReadScope.resolve(contexts, "VN", now, season, patch, false).allowUnscoped()).isFalse();
        assertThat(CatalogReadScope.resolve(contexts, "VN", now, season, patch, true).allowUnscoped()).isTrue();
        verify(contexts, times(2)).resolveCatalog("VN", now, season, patch);
        verifyNoMoreInteractions(contexts);
    }
}
