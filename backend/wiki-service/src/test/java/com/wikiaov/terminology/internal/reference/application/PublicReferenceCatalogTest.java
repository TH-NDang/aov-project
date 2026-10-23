package com.wikiaov.terminology.internal.reference.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ReadModelCache;
import com.wikiaov.terminology.internal.application.ReferenceErrorCode;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.domain.ReferenceSettings;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class PublicReferenceCatalogTest {
    private static final Instant BEFORE = Instant.parse("2026-09-29T00:59:00Z");
    private static final Instant RELEASE = Instant.parse("2026-09-29T01:00:00Z");
    private final PublicReferenceCatalogLoader loader = mock(PublicReferenceCatalogLoader.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final RecordingCache cache = new RecordingCache();
    private final MutableClock clock = new MutableClock(BEFORE);
    private final PublicReferenceCatalog catalog = new PublicReferenceCatalog(loader, contexts, cache, clock);

    @Test
    void resolvesTheCurrentPatchOnEveryRequestEvenWhenTheCatalogIsCached() {
        UUID ruleset = UUID.randomUUID();
        var previous = gameplay("VN", ruleset, 3, BEFORE.minusSeconds(100));
        var released = gameplay("VN", ruleset, 4, RELEASE);
        when(contexts.resolve("VN", BEFORE)).thenReturn(previous);
        when(contexts.resolve("VN", RELEASE)).thenReturn(released);
        var first = view(1);
        var second = view(2);
        when(loader.read(previous, BEFORE, "VN", "vi-VN")).thenReturn(first);
        when(loader.read(released, RELEASE, "VN", "vi-VN")).thenReturn(second);

        assertThat(catalog.read("VN", "vi-VN")).isSameAs(first);
        assertThat(catalog.read("VN", "vi-VN")).isSameAs(first);
        clock.at = RELEASE;
        assertThat(catalog.read("VN", "vi-VN")).isSameAs(second);

        verify(contexts, times(2)).resolve("VN", BEFORE);
        verify(contexts).resolve("VN", RELEASE);
        verify(loader).read(previous, BEFORE, "VN", "vi-VN");
        verify(loader).read(released, RELEASE, "VN", "vi-VN");
        verifyNoMoreInteractions(loader, contexts);
        assertThat(cache.keys).hasSize(3);
        assertThat(cache.keys.get(0)).isEqualTo(cache.keys.get(1));
        assertThat(cache.keys.get(2)).isNotEqualTo(cache.keys.get(0));
        assertThat(cache.keys.get(0).context()).contains(previous.patchVariantId().toString());
        assertThat(cache.keys.get(2).context()).contains(released.patchVariantId().toString());
        assertThat(cache.keys).allMatch(key -> key.area() == ReadModelCache.Area.PUBLIC_REFERENCES);
    }

    @Test
    void isolatesRegionsLocalesAndRulesetsWithoutUsingTheWallClockAsACacheKey() {
        UUID ruleset = UUID.randomUUID();
        var vietnam = gameplay("VN", ruleset, 3, BEFORE.minusSeconds(100));
        var taiwan = gameplay("TW", ruleset, 3, BEFORE.minusSeconds(100));
        var alternate = gameplay("VN", UUID.randomUUID(), 3, BEFORE.minusSeconds(100));
        when(contexts.resolve(eq("VN"), any(Instant.class))).thenReturn(vietnam, vietnam, vietnam, alternate);
        when(contexts.resolve(eq("TW"), any(Instant.class))).thenReturn(taiwan);
        var versions = new AtomicLong();
        when(loader.read(any(GameplayContext.class), any(Instant.class), anyString(), anyString()))
                .thenAnswer(ignored -> view(versions.incrementAndGet()));

        var original = catalog.read("VN", "vi-VN");
        clock.at = BEFORE.plusSeconds(5);
        assertThat(catalog.read("VN", "vi-VN")).isSameAs(original);
        assertThat(catalog.read("VN", "en-US")).isNotSameAs(original);
        assertThat(catalog.read("TW", "vi-VN")).isNotSameAs(original);
        assertThat(catalog.read("VN", "vi-VN")).isNotSameAs(original);

        assertThat(versions).hasValue(4);
        assertThat(cache.values).hasSize(4);
        assertThat(cache.keys.get(0)).isEqualTo(cache.keys.get(1));
        assertThat(cache.keys.get(2).context()).contains("en-US");
        assertThat(cache.keys.get(3).context()).startsWith("TW:");
        assertThat(cache.keys.get(4).context()).contains(alternate.rulesetId().toString());
    }

    @Test
    void passesTheSameResolvedContextAndCapturedTimeToTheLoader() {
        var gameplay = gameplay("VN", UUID.randomUUID(), 3, BEFORE.minusSeconds(100));
        when(contexts.resolve("VN", BEFORE)).thenAnswer(ignored -> {
            clock.at = RELEASE;
            return gameplay;
        });
        var expected = view(1);
        when(loader.read(gameplay, BEFORE, "VN", "vi-VN")).thenReturn(expected);

        assertThat(catalog.read("VN", "vi-VN")).isSameAs(expected);

        assertThat(clock.reads).isEqualTo(1);
        verify(loader).read(same(gameplay), eq(BEFORE), eq("VN"), eq("vi-VN"));
        verifyNoMoreInteractions(loader);
    }

    @Test
    void doesNotServeACachedResponseWhenGameplayResolutionRejectsTheRegion() {
        var failure = new IllegalStateException("No verified gameplay context");
        when(contexts.resolve("VN", BEFORE)).thenThrow(failure);

        assertThatThrownBy(() -> catalog.read("VN", "vi-VN")).isSameAs(failure);

        assertThat(cache.keys).isEmpty();
        verifyNoInteractions(loader);
    }

    @Test
    void rejectsMalformedNonCanonicalUndefinedAndOversizedLocalesBeforeAnyWork() {
        String oversized = "en-x-" + "abcdefgh-".repeat(7) + "abc";
        for (String locale : new String[] {null, "", "vi_VN", "en-US:x", "vi-vn", "VI-VN", "und", oversized}) {
            assertThatThrownBy(() -> catalog.read("VN", locale))
                    .isInstanceOfSatisfying(ApiException.class, error -> {
                        assertThat(error.getErrorCode()).isEqualTo(ReferenceErrorCode.REFERENCE_INVALID_LOCALE);
                        assertThat(error.getErrorCode().status()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                    });
        }
        assertThat(cache.keys).isEmpty();
        assertThat(clock.reads).isZero();
        verifyNoInteractions(contexts, loader);
    }

    private static GameplayContext gameplay(String region, UUID ruleset, long ordinal, Instant effectiveAt) {
        return new GameplayContext(UUID.randomUUID(), region, ruleset, "aov-standard", UUID.randomUUID(),
                "patch-" + ordinal, UUID.randomUUID(), ordinal, effectiveAt);
    }

    private static ReferenceSettingsView view(long version) {
        return new ReferenceSettingsView(version, new ReferenceSettings(1, true, "vi-VN", List.of()));
    }

    private record CacheKey(
            ReadModelCache.Area area,
            String context,
            Class<?> type
    ) {
    }

    private static class RecordingCache implements ReadModelCache {
        final Map<CacheKey, Object> values = new HashMap<>();
        final List<CacheKey> keys = new ArrayList<>();

        @Override
        public <T> T read(Area area, String context, Class<T> type, Supplier<T> loader) {
            var key = new CacheKey(area, context, type);
            keys.add(key);
            return type.cast(values.computeIfAbsent(key, ignored -> loader.get()));
        }
    }

    private static class MutableClock extends Clock {
        Instant at;
        int reads;

        MutableClock(Instant at) {
            this.at = at;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            reads++;
            return at;
        }
    }
}
