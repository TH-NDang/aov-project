package com.wikiaov.terminology.internal.reference.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.ReadModelCache;
import com.wikiaov.terminology.SkillReferenceProvider;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class SkillReferenceCatalogTest {
    private final SkillReferenceProvider skills = mock(SkillReferenceProvider.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final RecordingCache cache = new RecordingCache();
    private final Instant now = Instant.parse("2026-10-26T00:00:00Z");
    private final SkillReferenceCatalog catalog = new SkillReferenceCatalog(skills, contexts, cache,
            Clock.fixed(now, ZoneOffset.UTC));
    private final GameplayContext gameplay = new GameplayContext(UUID.randomUUID(), "VN", UUID.randomUUID(),
            "aov-standard", UUID.randomUUID(), "current", UUID.randomUUID(), 3, now.minusSeconds(60));

    @Test
    void currentAndHistoricalSkillCachesCannotShareDifferentUnscopedVisibility() {
        UUID season = UUID.randomUUID();
        when(contexts.resolve("VN", now)).thenReturn(gameplay);
        when(contexts.resolveCatalog("VN", now, season, null)).thenReturn(gameplay);
        var empty = new PageSlice<SkillReferenceProvider.Candidate>(List.of(), 0, 20, 0);
        when(skills.published(gameplay, now, "vi-VN", "", null, List.of(), 0, 20)).thenReturn(empty);
        when(skills.published(gameplay, now, "vi-VN", "", null, List.of(), 0, 20, false)).thenReturn(empty);

        catalog.published("VN", "vi-VN", "", null, null, 0, 20);
        catalog.published("VN", "vi-VN", "", null, null, 0, 20, season, null, false);
        catalog.published("VN", "vi-VN", "", null, null, 0, 20, season, null, true);

        assertThat(cache.values).hasSize(2);
        assertThat(cache.keys.getFirst()).contains("unscoped=true");
        assertThat(cache.keys.get(1)).contains("unscoped=false");
        assertThat(cache.keys.getLast()).isEqualTo(cache.keys.getFirst());
        verify(skills).published(gameplay, now, "vi-VN", "", null, List.of(), 0, 20);
        verify(skills).published(gameplay, now, "vi-VN", "", null, List.of(), 0, 20, false);
        verifyNoMoreInteractions(skills);
    }

    @Test
    void unavailableHistoricalScopeCannotFallBackToAnAlreadyCachedCurrentCatalog() {
        UUID patch = UUID.randomUUID();
        when(contexts.resolve("VN", now)).thenReturn(gameplay);
        when(skills.published(gameplay, now, "vi-VN", "", null, List.of(), 0, 20))
                .thenReturn(new PageSlice<>(List.of(), 0, 20, 0));
        catalog.published("VN", "vi-VN", "", null, null, 0, 20);
        when(contexts.resolveCatalog("VN", now, null, patch))
                .thenThrow(new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "Unavailable patch."));

        assertThatThrownBy(() -> catalog.published("VN", "vi-VN", "", null, null, 0, 20, null, patch, false))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_NOT_FOUND));
        assertThat(cache.keys).hasSize(1);
        verify(skills).published(gameplay, now, "vi-VN", "", null, List.of(), 0, 20);
        verifyNoMoreInteractions(skills);
    }

    private static final class RecordingCache implements ReadModelCache {
        private final Map<String, Object> values = new HashMap<>();
        private final List<String> keys = new ArrayList<>();

        @Override
        public <T> T read(Area area, String context, Class<T> type, Supplier<T> loader) {
            assertThat(area).isEqualTo(Area.PUBLIC_REFERENCES);
            keys.add(context);
            return type.cast(values.computeIfAbsent(context, ignored -> loader.get()));
        }
    }
}
