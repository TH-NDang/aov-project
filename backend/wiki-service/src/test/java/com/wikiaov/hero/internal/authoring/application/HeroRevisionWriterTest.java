package com.wikiaov.hero.internal.authoring.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.platform.ApiException;
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
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

class HeroRevisionWriterTest {
    private static final Instant NOW = Instant.parse("2026-10-20T00:00:00Z");

    private final HeroStore store = mock(HeroStore.class);
    private final CurrentActor actors = mock(CurrentActor.class);
    private final HeroRevisionWriter writer = new HeroRevisionWriter(store, mock(HeroSections.class), actors,
            Clock.fixed(NOW, ZoneOffset.UTC));
    private final UUID hero = UUID.randomUUID();
    private final UUID ruleset = UUID.randomUUID();

    @BeforeEach
    void signedIn() {
        when(actors.require()).thenReturn(new Actor("issuer", "editor", ActorType.HUMAN, "Editor", Set.of()));
    }

    @Test
    void aHeroCodeAlreadyInUseIsReportedAsHeroCodeExists() {
        doThrow(new DataIntegrityViolationException("hero_code_key")).when(store).insert(any(HeroIdentity.class));

        assertThatThrownBy(() -> writer.insertHero("airi")).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(HeroErrorCode.HERO_CODE_EXISTS));
    }

    @Test
    void aNewDraftIsNumberedAfterTheLatestRevisionOfItsRuleset() {
        when(store.revisions(hero)).thenReturn(List.of(revision(ruleset, 3, null), revision(UUID.randomUUID(), 7,
                null)));

        writer.insertDraft(hero, ruleset, null, Cause.GAME_PATCH, null);

        var inserted = ArgumentCaptor.forClass(HeroRevision.class);
        verify(store).insert(inserted.capture());
        assertThat(inserted.getValue().getRevisionNo()).isEqualTo(4);
        assertThat(inserted.getValue().getState()).isEqualTo(RevisionState.DRAFT);
        assertThat(inserted.getValue().getVersion()).isEqualTo(1);
    }

    @Test
    void aPublishedDraftComesAfterTheLatestPublicationOfItsRuleset() {
        var draft = revision(ruleset, 4, null);
        var entity = new HeroRevision();
        entity.setVersion(draft.version());
        when(store.editableEntity(draft.id())).thenReturn(entity);
        when(store.revisions(hero)).thenReturn(List.of(draft, revision(ruleset, 3, 2L),
                revision(UUID.randomUUID(), 9, 5L)));

        writer.publish(hero, draft);

        assertThat(entity.getState()).isEqualTo(RevisionState.PUBLISHED);
        assertThat(entity.getPublicationSequence()).isEqualTo(3L);
        assertThat(entity.getPublishedAt()).isEqualTo(NOW);
        assertThat(entity.getVersion()).isEqualTo(draft.version() + 1);
    }

    private HeroRevisionView revision(UUID rulesetId, long revisionNo, Long publicationSequence) {
        var state = publicationSequence == null ? RevisionState.DRAFT : RevisionState.PUBLISHED;
        return new HeroRevisionView(UUID.randomUUID(), hero, rulesetId, revisionNo, state, 1, publicationSequence,
                publicationSequence == null ? null : NOW, Cause.GAME_PATCH, null, null, Map.of());
    }
}
