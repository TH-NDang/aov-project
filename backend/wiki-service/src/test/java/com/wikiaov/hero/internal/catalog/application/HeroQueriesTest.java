package com.wikiaov.hero.internal.catalog.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.hero.internal.skills.application.SkillLibraryIcons;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
    private final HeroForms forms = mock(HeroForms.class);
    private final HeroPatchHistory history = mock(HeroPatchHistory.class);
    private final HeroQueries queries = new HeroQueries(store, sections, contexts, media, new JsonMapper(),
            Clock.fixed(at, ZoneOffset.UTC), forms, mock(SkillLibraryIcons.class),
            new HeroReadMoments(contexts, history));

    @BeforeEach
    void resolvePublishedContext() {
        when(contexts.resolve("VN", at)).thenReturn(context);
        when(forms.structure()).thenReturn(new HeroFormStructure(List.of()));
    }

    @Test
    void thePublishedHeroesOfAMarketAreReadWithOneRevisionQuery() {
        var airi = hero("airi", Map.of());
        var baldum = hero("baldum", Map.of());
        var ids = List.of(airi.identity().getId(), baldum.identity().getId());
        when(store.heroes(false)).thenReturn(List.of(airi.identity(), baldum.identity()));
        var revisions = ids.stream().flatMap(id -> store.revisions(id).stream()).toList();
        when(store.revisions(ids)).thenReturn(revisions);
        clearInvocations(store);

        var published = queries.published("VN");

        assertThat(published.keySet()).containsExactly(airi.identity(), baldum.identity());
        verify(store).revisions(ids);
        verify(store, never()).revisions(any(UUID.class));
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

        var result = queries.list("VN", "en-US", 1, 1, "", null, "code,asc", null, null, false, false);

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

        var result = queries.list("VN", "vi-VN", 0, 20, "", null, "code,asc", null, null, false, false);

        assertThat(items(result)).hasSize(4).allSatisfy(item -> assertThat(item)
                .containsEntry("head", head).doesNotContainKey("portrait"));
        verify(media).findAll(Set.of(headId, missingId, blockedId, incompleteId));
        verifyNoMoreInteractions(media);
    }

    @Test
    void doesNotReadMediaForAnOutOfRangePage() {
        var hero = hero("airi", Map.of(MediaRole.HEAD, UUID.randomUUID()));
        when(store.heroes(false)).thenReturn(List.of(hero.identity()));

        var result = queries.list("VN", "vi-VN", 1, 20, "", null, "code,asc", null, null, false, false);

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

        assertThat(items(queries.list("VN", "vi-VN", 0, 20, "", null, "code,asc", season, null, false, false)))
                .isEmpty();
        assertThat(items(queries.list("VN", "vi-VN", 0, 20, "", null, "code,asc", season, null, true, false)))
                .singleElement().satisfies(item -> assertThat(item).containsEntry("unscopedBaseline", true));
        verify(contexts, times(2)).resolveCatalog("VN", at, season, null);
    }

    @Test
    void historicalPatchNamesTheLaterObservationAndLeavesOutAHeroIntroducedAfterIt() {
        UUID earlier = UUID.randomUUID();
        var season = UUID.randomUUID();
        var selected = new GameplayContext(context.regionId(), "VN", context.rulesetId(), "aov-standard",
                UUID.randomUUID(), "2026-09-29", earlier, 1, at);
        var veteran = hero("airi", Map.of());
        var newcomer = hero("evita", Map.of());
        when(contexts.resolveCatalog("VN", at, season, earlier)).thenReturn(selected);
        when(contexts.rulesetVariants(context.rulesetId()))
                .thenReturn(List.of(variant(earlier, 1), variant(context.patchVariantId(), 2)));
        when(contexts.patchCode(context.patchVariantId())).thenReturn("2026-10-15");
        when(history.introductions()).thenReturn(Map.of(newcomer.identity().getId(), context.patchVariantId()));
        when(store.heroes(false)).thenReturn(List.of(veteran.identity(), newcomer.identity()));
        observeAt(veteran, context.patchVariantId());
        observeAt(newcomer, context.patchVariantId());

        var result = queries.list("VN", "vi-VN", 0, 20, "", null, "code,asc", season, earlier, false, false);

        assertThat(items(result)).singleElement().satisfies(item -> assertThat(item)
                .containsEntry("code", "airi")
                .containsEntry("laterObservation",
                        Map.of("patchVariantId", context.patchVariantId(), "patchCode", "2026-10-15")));
    }

    @Test
    void currentCatalogNeverReadsALaterObservation() {
        var hero = hero("airi", Map.of());
        when(contexts.rulesetVariants(context.rulesetId()))
                .thenReturn(List.of(variant(context.patchVariantId(), 2), variant(UUID.randomUUID(), 3)));
        when(store.heroes(false)).thenReturn(List.of(hero.identity()));
        var scheduled = contexts.rulesetVariants(context.rulesetId()).get(1).id();
        observeAt(hero, scheduled);

        assertThat(items(queries.list("VN", "vi-VN", 0, 20, "", null, "code,asc", null, null, false, false))).isEmpty();
    }

    private void observeAt(CatalogHero hero, UUID variantId) {
        var revision = store.revisions(hero.identity().getId()).getFirst();
        when(store.revisions(hero.identity().getId())).thenReturn(List.of(new HeroRevisionView(revision.id(),
                revision.heroId(), revision.rulesetId(), 1, RevisionState.PUBLISHED, 1, 1L, at.minusSeconds(60),
                Cause.DATA_BASELINE, null, variantId, revision.sections())));
    }

    private PatchVariantReference variant(UUID id, long ordinal) {
        return new PatchVariantReference(id, UUID.randomUUID(), context.rulesetId(), null, ordinal, true);
    }

    private CatalogHero hero(String code, Map<MediaRole, UUID> assets) {
        var identity = new HeroIdentity();
        identity.setId(UUID.randomUUID());
        identity.setCode(code);
        UUID profileId = UUID.randomUUID();
        UUID bindingsId = UUID.randomUUID();
        var revision = new HeroRevisionView(UUID.randomUUID(), identity.getId(), context.rulesetId(), 1,
                RevisionState.PUBLISHED, 1, 1L, at.minusSeconds(60), Cause.DATA_BASELINE, null, null,
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
