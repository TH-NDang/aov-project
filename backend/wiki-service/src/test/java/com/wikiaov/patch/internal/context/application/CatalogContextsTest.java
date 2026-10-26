package com.wikiaov.patch.internal.context.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.response.RegionView;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository.*;
import com.wikiaov.patch.internal.context.persistence.SeasonUpdatesRepository;
import com.wikiaov.patch.internal.ruleset.application.Regions;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.*;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

class CatalogContextsTest {
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final GameplayContextRepository repository = mock(GameplayContextRepository.class);
    private final SeasonUpdatesRepository translations = mock(SeasonUpdatesRepository.class);
    private final Regions regions = mock(Regions.class);
    private final Instant now = Instant.parse("2026-10-26T00:00:00Z");
    private final CatalogContexts service = new CatalogContexts(contexts, repository, translations, regions,
            Clock.fixed(now, ZoneOffset.UTC));
    private final UUID region = UUID.randomUUID(), ruleset = UUID.randomUUID();
    private final UUID oldSeason = UUID.randomUUID(), currentSeason = UUID.randomUUID();
    private final UUID oldVariant = UUID.randomUUID(), middleVariant = UUID.randomUUID(),
            currentVariant = UUID.randomUUID();
    private final UUID oldPatch = UUID.randomUUID(), middlePatch = UUID.randomUUID(), currentPatch = UUID.randomUUID();

    @Test
    void returnsPublishedScopedSeasonsLocalizedTitlesAndOnlyKnownMarketDates() {
        stubContext();
        var old = patch(oldVariant, oldPatch, oldSeason, "s3-observed", 1, 1);
        var middle = patch(middleVariant, middlePatch, currentSeason, "2026-09-29", 2, 2);
        var current = patch(currentVariant, currentPatch, currentSeason, "2026-10-15", 2, 3);
        when(repository.catalogPatches(ruleset, now, 3, null, null, Pageable.unpaged()))
                .thenReturn(List.of(current, middle, old));
        var dates = List.of(date(currentVariant, LocalDate.of(2026, 10, 15), now.minusSeconds(60)),
                date(middleVariant, null, Instant.parse("2026-09-28T18:00:00Z")));
        var titles = List.of(text(currentPatch, "Mid-season update"), text(currentPatch, "Bản địa"),
                text(oldPatch, "Observed baseline"));
        when(repository.catalogDates(region, List.of(currentVariant, middleVariant, oldVariant), now))
                .thenReturn(dates);
        when(translations.preferredTexts(List.of(currentPatch, middlePatch, oldPatch), "en-US"))
                .thenReturn(titles);

        var result = service.read("VN", "en-US");

        assertThat(result.regions()).hasSize(2).anySatisfy(market -> assertThat(market.available()).isFalse());
        assertThat(result.locales()).extracting(locale -> locale.code()).containsExactly("vi-VN", "en-US");
        assertThat(result.current().rulesetId()).isEqualTo(ruleset);
        assertThat(result.current().seasonId()).isEqualTo(currentSeason);
        assertThat(result.current().patchVariantId()).isEqualTo(currentVariant);
        assertThat(result.seasons()).extracting(season -> season.ordinal()).containsExactly(2L, 1L);
        var season = result.seasons().getFirst();
        assertThat(season.current()).isTrue();
        assertThat(season.patches()).extracting(value -> value.ordinal()).containsExactly(3L, 2L);
        assertThat(season.patches().getFirst().title()).isEqualTo("Mid-season update");
        assertThat(season.patches().getFirst().regionalDate()).isEqualTo(LocalDate.of(2026, 10, 15));
        assertThat(season.patches().getLast().regionalDate()).isEqualTo(LocalDate.of(2026, 9, 29));
        assertThat(season.patches().getLast().title()).isEqualTo("2026-09-29");
        assertThat(result.seasons().getLast().current()).isFalse();
        assertThat(result.seasons().getLast().patches()).singleElement().satisfies(value -> {
            assertThat(value.unknownDate()).isTrue();
            assertThat(value.regionalDate()).isNull();
            assertThat(value.published()).isTrue();
        });
    }

    @Test
    void rejectsUnsupportedLocalesBeforeReadingAndKeepsMissingContextErrors() {
        assertThatThrownBy(() -> service.read("VN", "fr-FR")).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER));
        verifyNoInteractions(contexts, repository, translations, regions);
        when(contexts.resolve("VN", now)).thenThrow(new ApiException(PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE,
                "No verified context."));

        assertThatThrownBy(() -> service.read("VN", "vi-VN")).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE));
        verifyNoInteractions(repository, translations, regions);
    }

    private void stubContext() {
        when(contexts.resolve("VN", now)).thenReturn(new GameplayContext(region, "VN", ruleset, "aov-standard",
                currentPatch, "2026-10-15", currentVariant, 3, now.minusSeconds(60)));
        when(regions.list()).thenReturn(List.of(
                new RegionView(region, "VN", "Việt Nam", "AOV", "vi-VN", "Asia/Ho_Chi_Minh", true, null),
                new RegionView(UUID.randomUUID(), "TH", "Thailand", "RoV", "th-TH", "Asia/Bangkok", false,
                        "Not supported yet.")));
    }

    private CatalogPatch patch(UUID id, UUID patchId, UUID seasonId, String code, long seasonOrder, long ordinal) {
        var value = mock(CatalogPatch.class);
        when(value.getId()).thenReturn(id);
        when(value.getPatchId()).thenReturn(patchId);
        when(value.getCode()).thenReturn(code);
        when(value.getRulesetId()).thenReturn(ruleset);
        when(value.getSeasonId()).thenReturn(seasonId);
        when(value.getSeasonCode()).thenReturn("season-" + seasonOrder);
        when(value.getSeasonName()).thenReturn("Season " + seasonOrder);
        when(value.getSeasonOrdinal()).thenReturn(seasonOrder);
        when(value.getOrdinal()).thenReturn(ordinal);
        return value;
    }

    private CatalogDate date(UUID id, LocalDate day, Instant at) {
        var value = mock(CatalogDate.class);
        when(value.getPatchVariantId()).thenReturn(id);
        when(value.getEffectiveOn()).thenReturn(day);
        when(value.getEffectiveAt()).thenReturn(at);
        return value;
    }

    private SeasonUpdatesRepository.Text text(UUID id, String title) {
        var value = mock(SeasonUpdatesRepository.Text.class);
        when(value.getPatchId()).thenReturn(id);
        when(value.getTitle()).thenReturn(title);
        return value;
    }
}
