package com.wikiaov.hero.internal.skins.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.access.*;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.SkinImagePublicationRequest;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.*;
import com.wikiaov.platform.ApiException;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class SkinImagePublicationsTest {
    private final HeroStore store = mock(HeroStore.class);
    private final HeroSections sections = mock(HeroSections.class);
    private final HeroQueries queries = mock(HeroQueries.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final HeroValidation validation = mock(HeroValidation.class);
    private final CurrentActor actors = mock(CurrentActor.class);
    private final AuditLog audit = mock(AuditLog.class);
    private final Instant now = Instant.parse("2026-10-25T10:00:00Z");
    private final UUID heroId = UUID.randomUUID();
    private final UUID rulesetId = UUID.randomUUID();
    private final GameplayContext context = new GameplayContext(UUID.randomUUID(), "VN", rulesetId, "aov-standard",
            UUID.randomUUID(), "2026-10-15", UUID.randomUUID(), 2, now.minusSeconds(100));
    private final HeroRevisionView source = revision("PUBLISHED", 4, 2L);
    private final HeroRevisionView draft = revision("DRAFT", 9, null);
    private final AtomicReference<HeroRevision> inserted = new AtomicReference<>();
    private final SkinImagePublications publications = new SkinImagePublications(store, sections, queries, contexts,
            validation, actors, audit, Clock.fixed(now, ZoneOffset.UTC));

    @BeforeEach
    void prepareCurrentHero() {
        when(contexts.resolve("VN", now)).thenReturn(context);
        when(queries.current(heroId, context, now)).thenReturn(Optional.of(source));
        when(store.revision(eq(heroId), any(UUID.class))).thenAnswer(invocation -> {
            UUID id = invocation.getArgument(1);
            return id.equals(draft.id()) ? draft : publishedView(inserted.get());
        });
        when(store.revisions(heroId)).thenReturn(List.of(source, draft));
        when(actors.require()).thenReturn(new Actor("issuer", "editor", ActorType.HUMAN, "Editor",
                Set.of("hero:write", "hero:publish")));
        doAnswer(invocation -> {
            inserted.set(invocation.getArgument(0));
            return null;
        }).when(store).insert(any(HeroRevision.class));
    }

    @Test
    void publishesOnlyMatchingArtworkWithoutChangingDraftOrPublishedFields() {
        UUID oldArt = UUID.randomUUID();
        UUID newArt = UUID.randomUUID();
        UUID head = UUID.randomUUID();
        UUID portrait = UUID.randomUUID();
        var originalText = new SkinTranslation("vi-VN", "Published name", "Published text", "Published source");
        var original = skin("aleister-default-1", 5, oldArt, "original-badge", originalText, null, null, Map.of());
        var donor = skin("aleister-default-1", 999, newArt, "draft-badge",
                new SkinTranslation("vi-VN", "Unreviewed draft name", null, null), head, portrait,
                Map.of(MediaRole.PORTRAIT, List.of(new ImageOption(portrait, "Portrait"))));
        var unrelated = skin("aleister-extra-1", 0, UUID.randomUUID(), null, originalText, null, null, Map.of());
        var previous = new Skins(List.of(original), List.of());
        var collected = new Skins(List.of(donor, unrelated), List.of());
        prepareSkins(previous, collected);
        UUID skinsId = UUID.randomUUID();
        when(sections.create(eq(heroId), eq(HeroSection.SKINS), any(), any(), eq(now))).thenReturn(skinsId);

        var result = publications.publish(heroId, request(source.id(), draft.version()));

        var merged = ArgumentCaptor.forClass(Object.class);
        verify(validation).validatePublication(eq(HeroSection.SKINS), merged.capture());
        var skins = (Skins) merged.getValue();
        assertThat(skins.sources()).isEqualTo(previous.sources());
        assertThat(skins.skins()).singleElement().satisfies(skin -> {
            assertThat(skin.skinKey()).isEqualTo(original.skinKey());
            assertThat(skin.displayOrder()).isEqualTo(5);
            assertThat(skin.translations()).containsExactly(originalText);
            assertThat(skin.rarityCode()).isEqualTo("original-badge");
            assertThat(skin.artAssetId()).isEqualTo(newArt);
            assertThat(skin.headAssetId()).isEqualTo(head);
            assertThat(skin.portraitAssetId()).isEqualTo(portrait);
            assertThat(skin.images().get(MediaRole.SPLASH)).containsExactly(new ImageOption(oldArt, null));
        });
        assertThat(result.state()).isEqualTo("PUBLISHED");
        assertThat(result.cause()).isEqualTo(Cause.VISUAL_UPDATE);
        assertThat(result.sourceRevisionId()).isEqualTo(source.id());
        assertThat(result.effectiveFromPatchVariantId()).isEqualTo(source.effectiveFromPatchVariantId());
        assertThat(result.publicationSequence()).isEqualTo(3);
        assertThat(result.revisionNo()).isEqualTo(10);
        assertThat(result.sections()).containsEntry(HeroSection.SKINS, skinsId);
        for (var section : HeroSection.values())
            if (section != HeroSection.SKINS)
                assertThat(result.sections().get(section)).isEqualTo(source.sections().get(section));
        assertThat(draft.state()).isEqualTo("DRAFT");
        assertThat(draft.version()).isEqualTo(9);
        verify(store, never()).editableEntity(any());
        verify(sections).publish(HeroSection.SKINS, skinsId, heroId);
        verify(audit).record(any(AuditEntry.class));
    }

    @Test
    void retainsPublishedImageWhenDonorIsIncompleteAndDoesNotCreateANoopRevision() {
        var text = new SkinTranslation("vi-VN", "Published name", null, null);
        UUID art = UUID.randomUUID();
        var original = skin("aleister-default-1", 1, art, null, text, null, null, Map.of());
        var donor = skin("aleister-default-1", 8, null, null,
                new SkinTranslation("vi-VN", "Draft name", null, null), null, null, Map.of());
        prepareSkins(new Skins(List.of(original), List.of()), new Skins(List.of(donor), List.of()));

        assertThat(publications.publish(heroId, request(source.id(), draft.version()))).isEqualTo(source);

        verify(store, never()).insert(any(HeroRevision.class));
        verifyNoInteractions(audit, validation);
    }

    @Test
    void rejectsAChangedPublishedSourceBeforeReadingImageSections() {
        assertThatThrownBy(() -> publications.publish(heroId, request(UUID.randomUUID(), draft.version())))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode())
                                .isEqualTo(HeroErrorCode.HERO_REVISION_VERSION_CONFLICT));

        verifyNoInteractions(sections, validation, audit);
        verify(store, never()).insert(any(HeroRevision.class));
    }

    @Test
    void rejectsConcurrentDraftChangesBeforeReadingImageSections() {
        assertThatThrownBy(() -> publications.publish(heroId, request(source.id(), draft.version() - 1)))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode())
                                .isEqualTo(HeroErrorCode.HERO_REVISION_VERSION_CONFLICT));

        verifyNoInteractions(sections, validation, audit);
        verify(store, never()).insert(any(HeroRevision.class));
    }

    @Test
    void rejectsWrongRulesetOrNonDraftImageSources() {
        var other = new HeroRevisionView(draft.id(), heroId, UUID.randomUUID(), 9, "DRAFT", 9,
                null, null, Cause.VISUAL_UPDATE, source.id(), context.patchVariantId(), draft.sections());
        when(store.revision(heroId, draft.id())).thenReturn(other);

        assertThatThrownBy(() -> publications.publish(heroId, request(source.id(), draft.version())))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode())
                                .isEqualTo(HeroErrorCode.HERO_INVALID_CONTENT));

        verifyNoInteractions(sections, validation, audit);
    }

    @Test
    void doesNotPublishOrPersistWhenMediaValidationFails() {
        var text = new SkinTranslation("vi-VN", "Published name", null, null);
        var previous = new Skins(List.of(skin("aleister-default-1", 1, null, null, text, null, null, Map.of())),
                List.of());
        var collected = new Skins(List.of(skin("aleister-default-1", 1, UUID.randomUUID(), null,
                text, null, null, Map.of())), List.of());
        prepareSkins(previous, collected);
        doThrow(new ApiException(HeroErrorCode.HERO_INVALID_MEDIA, "The asset is not usable."))
                .when(validation).validatePublication(eq(HeroSection.SKINS), any());

        assertThatThrownBy(() -> publications.publish(heroId, request(source.id(), draft.version())))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(HeroErrorCode.HERO_INVALID_MEDIA));

        verify(sections, never()).create(any(), any(), any(), any(), any());
        verify(sections, never()).publish(any(), any(), any());
        verify(store, never()).insert(any(HeroRevision.class));
        verifyNoInteractions(audit);
    }

    private SkinImagePublicationRequest request(UUID sourceId, long version) {
        return new SkinImagePublicationRequest(sourceId, draft.id(), version, "VN", "Publish collected skin images");
    }

    private void prepareSkins(Skins previous, Skins collected) {
        when(sections.content(HeroSection.SKINS, source.sections().get(HeroSection.SKINS))).thenReturn(previous);
        when(sections.content(HeroSection.SKINS, draft.sections().get(HeroSection.SKINS))).thenReturn(collected);
    }

    private HeroRevisionView revision(String state, long revisionNo, Long publicationSequence) {
        Map<HeroSection, UUID> refs = new EnumMap<>(HeroSection.class);
        for (var section : HeroSection.values())
            refs.put(section, UUID.randomUUID());
        return new HeroRevisionView(UUID.randomUUID(), heroId, rulesetId, revisionNo, state, revisionNo,
                publicationSequence, publicationSequence == null ? null : now.minusSeconds(50),
                Cause.VISUAL_UPDATE, null, context.patchVariantId(), refs);
    }

    private static HeroRevisionView publishedView(HeroRevision entity) {
        Map<HeroSection, UUID> refs = new EnumMap<>(HeroSection.class);
        refs.put(HeroSection.PROFILE, entity.getProfileRevisionId());
        refs.put(HeroSection.OVERVIEW_RATINGS, entity.getOverviewRatingRevisionId());
        refs.put(HeroSection.COMBAT_STATS, entity.getCombatStatsRevisionId());
        refs.put(HeroSection.SKILLS, entity.getSkillsRevisionId());
        refs.put(HeroSection.SKINS, entity.getSkinsRevisionId());
        refs.put(HeroSection.MEDIA_BINDINGS, entity.getMediaBindingRevisionId());
        return new HeroRevisionView(entity.getId(), entity.getHeroId(), entity.getRulesetId(), entity.getRevisionNo(),
                entity.getState(), entity.getVersion(), entity.getPublicationSequence(), entity.getPublishedAt(),
                Cause.valueOf(entity.getCause()), entity.getSourceRevisionId(), entity.getEffectiveFromPatchVariantId(),
                refs);
    }

    private static Skin skin(String key, int order, UUID art, String rarity, SkinTranslation text, UUID head,
            UUID portrait, Map<MediaRole, List<ImageOption>> images) {
        return new Skin(key, order, art, rarity, List.of(text), head, portrait, images);
    }
}
