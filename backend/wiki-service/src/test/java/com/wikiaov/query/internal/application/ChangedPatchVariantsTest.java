package com.wikiaov.query.internal.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.wikiaov.hero.HeroChangeEntry;
import com.wikiaov.hero.HeroChangeQueries;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchCatalog;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogChangeProvider;
import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.ReadModelCache;
import com.wikiaov.spell.SpellChangeQueries;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

class ChangedPatchVariantsTest {
    private static final Instant NOW = Instant.parse("2026-11-26T00:00:00Z");
    private final UUID ruleset = UUID.randomUUID();
    private final UUID current = UUID.randomUUID();
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final HeroChangeQueries heroes = mock(HeroChangeQueries.class);
    private final CatalogChangeProvider items = mock(CatalogChangeProvider.class);
    private final ReadModelCache cache = new ReadModelCache() {
        @Override
        public <T> T read(Area area, String context, Class<T> type, Supplier<T> loader) {
            return loader.get();
        }
    };

    private ChangedPatchVariants changed() {
        when(items.domain()).thenReturn("ITEM");
        when(contexts.resolve(eq("VN"), any())).thenReturn(new GameplayContext(UUID.randomUUID(), "VN", ruleset,
                "aov-standard", UUID.randomUUID(), "2026-11-17", current, 3, NOW));
        var pages = new PatchPages(mock(PatchCatalog.class), heroes, mock(SpellChangeQueries.class), List.of(items));
        return new ChangedPatchVariants(pages, contexts, cache, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private PatchVariantReference variant(UUID id, long ordinal, boolean published) {
        return new PatchVariantReference(id, UUID.randomUUID(), ruleset, UUID.randomUUID(), ordinal, published);
    }

    @Test
    void listsOnlyPublishedVariantsUpToTheCurrentOneWhoseHeroesChangedNewestFirst() {
        var older = UUID.randomUUID();
        var quiet = UUID.randomUUID();
        var later = UUID.randomUUID();
        var draft = UUID.randomUUID();
        var service = changed();
        when(contexts.rulesetVariants(ruleset)).thenReturn(List.of(variant(older, 1, true), variant(quiet, 2, true),
                variant(current, 3, true), variant(later, 4, true), variant(draft, 2, false)));
        HeroChangeEntry.Line line = new HeroChangeEntry.OtherLine(UUID.randomUUID(), null, 0,
                HeroChangeEntry.OtherLine.TYPE, "Hồi chiêu giảm");
        var edited = mock(HeroChangeEntry.class);
        when(edited.changes()).thenReturn(List.of(line));
        var empty = mock(HeroChangeEntry.class);
        when(empty.changes()).thenReturn(List.of());
        when(heroes.forVariant(any(), anyString())).thenReturn(List.of());
        when(heroes.forVariant(eq(older), anyString())).thenReturn(List.of(edited));
        when(heroes.forVariant(eq(quiet), anyString())).thenReturn(List.of(empty));
        when(heroes.forVariant(eq(current), anyString())).thenReturn(List.of(empty, edited));
        when(heroes.forVariant(eq(later), anyString())).thenReturn(List.of(edited));

        var result = service.read("VN", "HERO");

        assertThat(result.domain()).isEqualTo("HERO");
        assertThat(result.variantIds()).containsExactly(current, older);
    }

    @Test
    void marksACatalogDomainByTheRowsItsPatchPageWouldList() {
        var changedVariant = UUID.randomUUID();
        var baselineOnly = UUID.randomUUID();
        var service = changed();
        when(contexts.rulesetVariants(ruleset))
                .thenReturn(List.of(variant(changedVariant, 2, true), variant(baselineOnly, 1, true)));
        when(items.changes(ruleset, changedVariant, "vi-VN")).thenReturn(List.of(entry(changedVariant,
                CatalogChanges.Kind.BUFF)));
        when(items.changes(ruleset, baselineOnly, "vi-VN")).thenReturn(List.of(entry(baselineOnly,
                CatalogChanges.Kind.DATA_BASELINE)));

        assertThat(service.read("VN", "ITEM").variantIds()).containsExactly(changedVariant);
    }

    @Test
    void refusesADomainWithoutAChangeProviderBeforeReadingTheCatalog() {
        var service = changed();

        assertThatThrownBy(() -> service.read("VN", "SKIN")).isInstanceOf(ApiException.class);
        verifyNoInteractions(heroes);
    }

    private CatalogChanges.Entry entry(UUID variant, CatalogChanges.Kind kind) {
        return new CatalogChanges.Entry(UUID.randomUUID(), "ITEM", UUID.randomUUID(), "blade", "Blade", null, ruleset,
                variant, null, UUID.randomUUID(), List.of(kind), null, null, null, false, null);
    }
}
