package com.wikiaov.hero.internal.catalog.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.media.*;
import com.wikiaov.patch.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class HeroQueriesTest {
    private final HeroStore store = mock(HeroStore.class);
    private final HeroSections sections = mock(HeroSections.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final MediaAssets media = mock(MediaAssets.class);
    private final Instant at = Instant.parse("2026-10-20T00:00:00Z");
    private final GameplayContext context = new GameplayContext(UUID.randomUUID(), "VN", UUID.randomUUID(),
            "aov-standard", UUID.randomUUID(), "2026-10-15", UUID.randomUUID(), 2, at);
    private final HeroQueries queries = new HeroQueries(store, sections, contexts, media, new JsonMapper(),
            Clock.fixed(at, ZoneOffset.UTC));

    @BeforeEach
    void resolvePublishedContext() {
        when(contexts.resolve("VN", at)).thenReturn(context);
    }

    @Test
    void hydratesOnlySelectedPageAndBatchesHeadAndPortraitTogether() {
        var first = hero("airi", Map.of());
        UUID headId = UUID.randomUUID();
        UUID portraitId = UUID.randomUUID();
        UUID splashId = UUID.randomUUID();
        var selected = hero("baldum", Map.of(MediaRole.HEAD, headId, MediaRole.PORTRAIT, portraitId,
                MediaRole.SPLASH, splashId));
        var last = hero("dirak", Map.of());
        when(store.heroes(false)).thenReturn(List.of(first.identity(), selected.identity(), last.identity()));
        var head = asset(headId, MediaSemanticType.HERO_HEAD, MediaAssetState.ACTIVE);
        var portrait = asset(portraitId, MediaSemanticType.HERO_PORTRAIT, MediaAssetState.ACTIVE);
        when(media.findAll(Set.of(headId, portraitId))).thenReturn(Map.of(headId, head, portraitId, portrait));

        var result = queries.list("VN", "en-US", 1, 1, "", null, "code,asc");

        assertThat(items(result)).singleElement().satisfies(item -> assertThat(item)
                .containsEntry("id", selected.identity().getId())
                .containsEntry("code", "baldum")
                .containsEntry("name", "baldum")
                .containsEntry("actualLocale", "vi-VN")
                .containsEntry("head", head)
                .containsEntry("portrait", portrait)
                .doesNotContainKey("splash"));
        assertThat(result).containsEntry("totalElements", 3).containsEntry("totalPages", 3);
        verify(sections).content(HeroSection.MEDIA_BINDINGS, selected.bindingsId());
        verify(sections, never()).content(HeroSection.MEDIA_BINDINGS, first.bindingsId());
        verify(sections, never()).content(HeroSection.MEDIA_BINDINGS, last.bindingsId());
        verify(sections, never()).content(eq(HeroSection.SKILLS), any());
        verify(sections, never()).content(eq(HeroSection.SKINS), any());
        verify(media).findAll(Set.of(headId, portraitId));
        verifyNoMoreInteractions(media);
    }

    @Test
    void omitsAbsentMissingAndUnusablePortraitsWithoutRelabelingHead() {
        UUID headId = UUID.randomUUID();
        UUID missingId = UUID.randomUUID();
        UUID blockedId = UUID.randomUUID();
        UUID incompleteId = UUID.randomUUID();
        var absent = hero("airi", Map.of(MediaRole.HEAD, headId));
        var missing = hero("baldum", Map.of(MediaRole.HEAD, headId, MediaRole.PORTRAIT, missingId));
        var blocked = hero("dirak", Map.of(MediaRole.HEAD, headId, MediaRole.PORTRAIT, blockedId));
        var incomplete = hero("errol", Map.of(MediaRole.HEAD, headId, MediaRole.PORTRAIT, incompleteId));
        when(store.heroes(false))
                .thenReturn(List.of(absent.identity(), missing.identity(), blocked.identity(), incomplete.identity()));
        var head = asset(headId, MediaSemanticType.HERO_HEAD, MediaAssetState.ACTIVE);
        var blockedPortrait = asset(blockedId, MediaSemanticType.HERO_PORTRAIT, MediaAssetState.BLOCKED);
        var incompletePortrait = new MediaAssetReference(incompleteId, MediaSemanticType.HERO_PORTRAIT,
                MediaAssetState.ACTIVE, null);
        when(media.findAll(Set.of(headId, missingId, blockedId, incompleteId)))
                .thenReturn(Map.of(headId, head, blockedId, blockedPortrait, incompleteId, incompletePortrait));

        var result = queries.list("VN", "vi-VN", 0, 20, "", null, "code,asc");

        assertThat(items(result)).hasSize(4).allSatisfy(item -> assertThat(item)
                .containsEntry("head", head).doesNotContainKey("portrait"));
        verify(media).findAll(Set.of(headId, missingId, blockedId, incompleteId));
        verifyNoMoreInteractions(media);
    }

    @Test
    void doesNotReadMediaForAnOutOfRangePage() {
        var hero = hero("airi", Map.of(MediaRole.HEAD, UUID.randomUUID()));
        when(store.heroes(false)).thenReturn(List.of(hero.identity()));

        var result = queries.list("VN", "vi-VN", 1, 20, "", null, "code,asc");

        assertThat(items(result)).isEmpty();
        assertThat(result).containsEntry("totalElements", 1).containsEntry("totalPages", 1);
        verify(sections, never()).content(HeroSection.MEDIA_BINDINGS, hero.bindingsId());
        verifyNoInteractions(media);
    }

    @Test
    void historicalSeasonDoesNotClaimAnUnscopedHeroWasPresentUnlessOptedIn() {
        var hero = hero("airi", Map.of());
        var season = UUID.randomUUID();
        when(contexts.resolveCatalog("VN", at, season, null)).thenReturn(context);
        when(store.heroes(false)).thenReturn(List.of(hero.identity()));

        assertThat(items(queries.list("VN", "vi-VN", 0, 20, "", null, "code,asc", season, null, false)))
                .isEmpty();
        assertThat(items(queries.list("VN", "vi-VN", 0, 20, "", null, "code,asc", season, null, true)))
                .singleElement().satisfies(item -> assertThat(item).containsEntry("unscopedBaseline", true));
        verify(contexts, never()).resolve("VN", at);
    }

    private CatalogHero hero(String code, Map<MediaRole, UUID> assets) {
        var identity = new HeroIdentity();
        identity.setId(UUID.randomUUID());
        identity.setCode(code);
        UUID profileId = UUID.randomUUID();
        UUID bindingsId = UUID.randomUUID();
        var revision = new HeroRevisionView(UUID.randomUUID(), identity.getId(), context.rulesetId(), 1,
                "PUBLISHED", 1, 1L, at.minusSeconds(60), Cause.DATA_BASELINE, null, null,
                Map.of(HeroSection.PROFILE, profileId, HeroSection.MEDIA_BINDINGS, bindingsId));
        when(store.revisions(identity.getId())).thenReturn(List.of(revision));
        when(sections.content(HeroSection.PROFILE, profileId)).thenReturn(new Profile(
                List.of(new ProfileTranslation("vi-VN", code, null, null, null)), Set.of(Role.WARRIOR), List.of()));
        when(sections.content(HeroSection.MEDIA_BINDINGS, bindingsId)).thenReturn(new Bindings(assets, List.of()));
        return new CatalogHero(identity, bindingsId);
    }

    private static MediaAssetReference asset(UUID id, MediaSemanticType type, MediaAssetState state) {
        return new MediaAssetReference(id, type, state,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/png", 278, 436,
                        "https://img.example.test/" + id + ".png"));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<String, Object> result) {
        return (List<Map<String, Object>>) result.get("items");
    }

    private record CatalogHero(
            HeroIdentity identity,
            UUID bindingsId
    ) {
    }
}
