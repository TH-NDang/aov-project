package com.wikiaov.hero.internal.sections.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.hero.internal.profile.persistence.ProfileRevisionRepository;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileRevision;
import com.wikiaov.platform.RevisionState;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HeroSectionLifecycleTest {
    private final ProfileRevisionRepository profiles = mock(ProfileRevisionRepository.class);
    private final HeroSectionLifecycle lifecycle = new HeroSectionLifecycle();

    @Test
    void creationFlushesAnInsertOnlyDraftWithTheOriginalActorAndVersion() {
        var heroId = UUID.randomUUID();
        var actor = new Actor("issuer", "subject", ActorType.HUMAN, null, Set.of());
        var at = Instant.parse("2026-10-01T00:00:00Z");
        when(profiles.saveAndFlush(any(ProfileRevision.class))).thenAnswer(call -> call.getArgument(0));

        var revision = lifecycle.create(profiles, new ProfileRevision(), heroId, actor, at);

        assertThat(revision.getId()).isNotNull();
        assertThat(revision.getHeroId()).isEqualTo(heroId);
        assertThat(revision.getState()).isEqualTo(RevisionState.DRAFT);
        assertThat(revision.getVersion()).isEqualTo(1);
        assertThat(revision.getCreatedAt()).isEqualTo(at);
        assertThat(revision.getCreatedByIssuer()).isEqualTo("issuer");
        assertThat(revision.getCreatedBySubject()).isEqualTo("subject");
        assertThat(revision.isNew()).isTrue();
        verify(profiles).saveAndFlush(revision);
    }

    @Test
    void publicationFlushesBeforeLockingAndAfterChangingTheLockedDraft() {
        var revision = revision(RevisionState.DRAFT);
        when(profiles.lockById(revision.getId())).thenReturn(Optional.of(revision));

        lifecycle.publish(profiles, revision.getId(), revision.getHeroId());

        assertThat(revision.getState()).isEqualTo(RevisionState.PUBLISHED);
        var order = inOrder(profiles);
        order.verify(profiles).flush();
        order.verify(profiles).lockById(revision.getId());
        order.verify(profiles).flush();
        order.verifyNoMoreInteractions();
    }

    @Test
    void publicationRejectsDiscardedOrForeignSectionsWithoutASecondFlush() {
        for (var revision : List.of(revision(RevisionState.DISCARDED), revision(RevisionState.DRAFT))) {
            reset(profiles);
            when(profiles.lockById(revision.getId())).thenReturn(Optional.of(revision));
            var owner = revision.getState() == RevisionState.DRAFT ? UUID.randomUUID() : revision.getHeroId();

            assertThatThrownBy(() -> lifecycle.publish(profiles, revision.getId(), owner))
                    .isInstanceOf(IllegalStateException.class).hasMessage("Invalid section ownership or lifecycle.");

            verify(profiles).flush();
            assertThat(revision.getState()).isIn(RevisionState.DRAFT, RevisionState.DISCARDED);
        }
    }

    private static ProfileRevision revision(RevisionState state) {
        var revision = new ProfileRevision();
        revision.setId(UUID.randomUUID());
        revision.setHeroId(UUID.randomUUID());
        revision.setState(state);
        return revision;
    }
}
