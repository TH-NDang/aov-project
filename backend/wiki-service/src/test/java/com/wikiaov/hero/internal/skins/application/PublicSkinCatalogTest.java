package com.wikiaov.hero.internal.skins.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.skins.persistence.PublicSkinCatalogRepository;
import com.wikiaov.hero.internal.skins.persistence.PublicSkinCatalogRepository.*;
import com.wikiaov.media.*;
import com.wikiaov.patch.*;
import com.wikiaov.platform.ApiException;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PublicSkinCatalogTest {
    private final PublicSkinCatalogRepository repository = mock(PublicSkinCatalogRepository.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final MediaAssets media = mock(MediaAssets.class);
    private final Instant now = Instant.parse("2026-10-25T00:00:00Z");
    private final GameplayContext context = new GameplayContext(UUID.randomUUID(), "VN", UUID.randomUUID(),
            "aov-standard", UUID.randomUUID(), "2026-10-15", UUID.randomUUID(), 2, now);
    private final PublicSkinCatalog catalog = new PublicSkinCatalog(repository, contexts, media,
            Clock.fixed(now, ZoneOffset.UTC));

    @BeforeEach
    void resolveContext() {
        when(contexts.resolve("VN", now)).thenReturn(context);
    }

    @Test
    void selectsCurrentSnapshotAndHydratesOnlyTheRequestedPageIncludingLocalizedBadge() {
        UUID old = UUID.randomUUID();
        UUID current = UUID.randomUUID();
        UUID future = UUID.randomUUID();
        var baseline = candidate("airi", old, null, 1);
        var latest = candidate(baseline.getHeroId(), "airi", current, context.patchVariantId(), 2);
        var notEffective = candidate(baseline.getHeroId(), "airi", future, UUID.randomUUID(), 3);
        when(contexts.variant(context.patchVariantId())).thenReturn(variant(context.patchVariantId(), 2));
        when(contexts.variant(notEffective.getVariantId())).thenReturn(variant(notEffective.getVariantId(), 3));
        when(repository.candidates(context.rulesetId(), now)).thenReturn(List.of(baseline, latest, notEffective));
        when(repository.profileTexts(List.of(latest.getProfileId())))
                .thenReturn(List.of(profile(latest.getProfileId(), "vi-VN", "Airi")));
        var first = skin(current, "airi-first-1", 1, "ss-vn-1");
        var second = skin(current, "airi-second-1", 2, "ss-vn-1");
        when(repository.skins(List.of(current))).thenReturn(List.of(first, second));
        when(repository.skinTexts(List.of(current)))
                .thenReturn(List.of(text(current, first.getSkinKey(), "vi-VN", "Một"),
                        text(current, second.getSkinKey(), "vi-VN", "Hai")));
        var vietnamese = badge("ss-vn-1", "vi-VN", "Bậc SS");
        var english = badge("ss-vn-1", "en-US", "SS tier");
        when(repository.badgeTexts(List.of("ss-vn-1"))).thenReturn(List.of(vietnamese, english));
        UUID heroHead = UUID.randomUUID();
        when(repository.heads(List.of(latest.getBindingsId())))
                .thenReturn(List.of(head(latest.getBindingsId(), heroHead)));
        var ids = Set.of(second.getPortraitId(), second.getHeadId(), second.getArtId(), english.getIconId(), heroHead);
        when(media.findAll(ids)).thenReturn(Map.of(second.getPortraitId(), asset(second.getPortraitId()),
                second.getHeadId(), new MediaAssetReference(second.getHeadId(), MediaSemanticType.HERO_SKIN_ART,
                        MediaAssetState.BLOCKED, asset(second.getHeadId()).currentVersion()),
                english.getIconId(), asset(english.getIconId()), heroHead, asset(heroHead)));

        var result = catalog.read("VN", "en-US", "", null, null, 1, 1);

        assertThat(result.page().totalElements()).isEqualTo(2);
        assertThat(result.page().items()).singleElement().satisfies(entry -> {
            assertThat(entry.skinKey()).isEqualTo(second.getSkinKey());
            assertThat(entry.name()).isEqualTo("Hai");
            assertThat(entry.actualLocale()).isEqualTo("vi-VN");
            assertThat(entry.portrait().assetId()).isEqualTo(second.getPortraitId());
            assertThat(entry.head()).isNull();
            assertThat(entry.badge().name()).isEqualTo("SS tier");
            assertThat(entry.badge().actualLocale()).isEqualTo("en-US");
            assertThat(entry.badge().icon().assetId()).isEqualTo(english.getIconId());
        });
        verify(repository).skins(List.of(current));
        verify(media).findAll(ids);
        verifyNoMoreInteractions(media);
    }

    @Test
    void searchesWithoutAccentsKeepsFacetsAndExcludesStoredDefaultSkins() {
        var hero = candidate("diao-chan", UUID.randomUUID(), null, 1);
        when(repository.candidates(context.rulesetId(), now)).thenReturn(List.of(hero));
        when(repository.profileTexts(List.of(hero.getProfileId())))
                .thenReturn(List.of(profile(hero.getProfileId(), "vi-VN", "Điêu Thuyền")));
        var normal = skin(hero.getSkinsId(), "default", 0, null);
        var special = skin(hero.getSkinsId(), "diao-chan-nu-vuong-1", 1, "a-vn-1");
        when(repository.skins(List.of(hero.getSkinsId()))).thenReturn(List.of(normal, special));
        when(repository.skinTexts(List.of(hero.getSkinsId())))
                .thenReturn(List.of(text(hero.getSkinsId(), "default", "vi-VN", "Mặc định"),
                        text(hero.getSkinsId(), special.getSkinKey(), "vi-VN", "Nữ vương")));
        when(repository.badgeTexts(List.of("a-vn-1"))).thenReturn(List.of());
        when(media.findAll(anySet())).thenReturn(Map.of());

        var searched = catalog.read("VN", "en-US", "dieu thuyen nu vuong", null, null, 0, 24);
        assertThat(searched.page().items()).singleElement()
                .satisfies(entry -> assertThat(entry.name()).isEqualTo("Nữ vương"));
        var title = catalog.read("VN", "en-US", "nu vuong", "diao-chan", "a-vn-1", 0, 24);
        assertThat(title.page().items()).singleElement().satisfies(entry -> {
            assertThat(entry.name()).isEqualTo("Nữ vương");
            assertThat(entry.portrait()).isNull();
            assertThat(entry.badge()).isNull();
        });
        assertThat(title.heroes()).singleElement()
                .satisfies(filter -> assertThat(filter.name()).isEqualTo("Điêu Thuyền"));
        assertThat(title.rarities()).singleElement().satisfies(filter -> assertThat(filter.code()).isEqualTo("a-vn-1"));
        assertThat(catalog.read("VN", "vi-VN", "", null, null, 0, 24).page().items())
                .extracting(entry -> entry.skinKey()).containsExactly(special.getSkinKey());
    }

    @Test
    void excludesCanonicalAndLegacyDefaultsBeforePaginationRegardlessOfLocale() {
        var hero = candidate("airi", UUID.randomUUID(), null, 1);
        UUID skinsId = hero.getSkinsId();
        when(repository.candidates(context.rulesetId(), now)).thenReturn(List.of(hero));
        when(repository.skins(List.of(skinsId))).thenReturn(List.of(
                skin(skinsId, "default", 0, null),
                skin(skinsId, "airi-mac-dinh-1", 1, null),
                skin(skinsId, "airi-heroskin-1", 2, null),
                skin(skinsId, "airi-default-1", 3, null),
                skin(skinsId, "airi-default-special-1", 4, null),
                skin(skinsId, "airi-unbadged-1", 5, null)));
        when(repository.skinTexts(List.of(skinsId)))
                .thenReturn(List.of(text(skinsId, "airi-unbadged-1", "en-US", "Unbadged costume")));
        when(media.findAll(anySet())).thenReturn(Map.of());

        var first = catalog.read("VN", "en-US", "", null, null, 0, 1);
        var second = catalog.read("VN", "en-US", "", null, null, 1, 1);

        assertThat(first.page().totalElements()).isEqualTo(2);
        assertThat(first.page().items()).extracting(entry -> entry.skinKey())
                .containsExactly("airi-default-special-1");
        assertThat(second.page().totalElements()).isEqualTo(2);
        assertThat(second.page().items()).singleElement().satisfies(entry -> {
            assertThat(entry.skinKey()).isEqualTo("airi-unbadged-1");
            assertThat(entry.name()).isEqualTo("Unbadged costume");
            assertThat(entry.rarityCode()).isNull();
        });
        assertThat(second.rarities()).isEmpty();
    }

    @Test
    void omitsHeroesWithOnlyDefaultSkinsFromFacetsAndDoesNotLoadTheirMedia() {
        var hero = candidate("flowborn-ad", UUID.randomUUID(), null, 1);
        when(repository.candidates(context.rulesetId(), now)).thenReturn(List.of(hero));
        when(repository.skins(List.of(hero.getSkinsId())))
                .thenReturn(List.of(skin(hero.getSkinsId(), "flowborn-ad-mac-dinh-1", 0, null)));

        var result = catalog.read("VN", "vi-VN", "", null, null, 0, 24);

        assertThat(result.page().items()).isEmpty();
        assertThat(result.page().totalElements()).isZero();
        assertThat(result.heroes()).isEmpty();
        assertThat(result.rarities()).isEmpty();
        verifyNoInteractions(media);
    }

    @Test
    void historicalSeasonExcludesUnknownPatchSkinObservationsUntilOptedIn() {
        var hero = candidate("airi", UUID.randomUUID(), null, 1);
        var season = UUID.randomUUID();
        when(contexts.resolveCatalog("VN", now, season, null)).thenReturn(context);
        when(repository.candidates(context.rulesetId(), now)).thenReturn(List.of(hero));
        when(repository.skins(List.of(hero.getSkinsId())))
                .thenReturn(List.of(skin(hero.getSkinsId(), "airi-special-1", 1, null)));
        when(repository.skinTexts(List.of(hero.getSkinsId())))
                .thenReturn(List.of(text(hero.getSkinsId(), "airi-special-1", "vi-VN", "Special")));
        when(media.findAll(anySet())).thenReturn(Map.of());

        assertThat(catalog.read("VN", "vi-VN", "", null, null, 0, 24, season, null, false).page().items()).isEmpty();
        assertThat(catalog.read("VN", "vi-VN", "", null, null, 0, 24, season, null, true).page().items())
                .singleElement().satisfies(entry -> assertThat(entry.unscopedBaseline()).isTrue());
        verify(contexts, never()).resolve("VN", now);
    }

    @Test
    void validatesBoundsBeforeReadingPersistenceOrMedia() {
        assertThatThrownBy(() -> catalog.read("VN", "vi-VN", "", null, null, -1, 24)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> catalog.read("VN", "vi-VN", "", null, null, 0, 61)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> catalog.read("VN", "vi-VN", "x".repeat(121), null, null, 0, 24))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> catalog.read("VN", "vi-VN", "", " ", null, 0, 24)).isInstanceOf(ApiException.class);

        verifyNoInteractions(repository, media, contexts);
    }

    @Test
    void returnsAnEmptyPageWithoutHydrationWhenTheContextHasNoPublishedHero() {
        when(repository.candidates(context.rulesetId(), now)).thenReturn(List.of());

        var result = catalog.read("VN", "vi-VN", "", null, null, Integer.MAX_VALUE, 60);

        assertThat(result.page().items()).isEmpty();
        assertThat(result.page().totalElements()).isZero();
        assertThat(result.heroes()).isEmpty();
        verifyNoInteractions(media);
        verify(repository).candidates(context.rulesetId(), now);
        verifyNoMoreInteractions(repository);
    }

    private Candidate candidate(String code, UUID skinsId, UUID variantId, long sequence) {
        return candidate(UUID.randomUUID(), code, skinsId, variantId, sequence);
    }

    private Candidate candidate(UUID heroId, String code, UUID skinsId, UUID variantId, long sequence) {
        return new CandidateValue(heroId, code, UUID.randomUUID(), skinsId, UUID.randomUUID(), variantId, sequence);
    }

    private PatchVariantReference variant(UUID id, long ordinal) {
        return new PatchVariantReference(id, context.patchId(), context.rulesetId(), null, ordinal, true);
    }

    private ProfileText profile(UUID id, String locale, String name) {
        return new ProfileValue(id, locale, name);
    }

    private Skin skin(UUID id, String key, int order, String rarity) {
        return new SkinValue(id, key, order, rarity, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
    }

    private SkinText text(UUID id, String key, String locale, String name) {
        return new TextValue(id, key, locale, name);
    }

    private BadgeText badge(String code, String locale, String name) {
        return new BadgeValue(code, locale, name, UUID.randomUUID());
    }

    private Head head(UUID bindingsId, UUID id) {
        return new HeadValue(bindingsId, id);
    }

    private MediaAssetReference asset(UUID id) {
        return new MediaAssetReference(id, MediaSemanticType.HERO_SKIN_ART, MediaAssetState.ACTIVE,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/webp", 278, 436,
                        "https://img.athahub.com/assets/" + id + ".webp"));
    }

    private record CandidateValue(
            UUID getHeroId,
            String getHeroCode,
            UUID getProfileId,
            UUID getSkinsId,
            UUID getBindingsId,
            UUID getVariantId,
            Long getPublicationSequence
    ) implements Candidate {
    }

    private record ProfileValue(
            UUID getProfileId,
            String getLocale,
            String getName
    ) implements ProfileText {
    }

    private record SkinValue(
            UUID getSkinsId,
            String getSkinKey,
            int getDisplayOrder,
            String getRarityCode,
            UUID getPortraitId,
            UUID getHeadId,
            UUID getArtId
    ) implements Skin {
    }

    private record TextValue(
            UUID getSkinsId,
            String getSkinKey,
            String getLocale,
            String getName
    ) implements SkinText {
    }

    private record BadgeValue(
            String getCode,
            String getLocale,
            String getName,
            UUID getIconId
    ) implements BadgeText {
    }

    private record HeadValue(
            UUID getBindingsId,
            UUID getAssetId
    ) implements Head {
    }
}
