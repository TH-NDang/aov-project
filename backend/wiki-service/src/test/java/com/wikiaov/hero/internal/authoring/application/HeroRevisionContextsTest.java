package com.wikiaov.hero.internal.authoring.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.hero.internal.application.HeroCommands.Fork;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HeroRevisionContextsTest {
    private static final Instant NOW = Instant.parse("2026-10-20T00:00:00Z");

    private final HeroStore store = mock(HeroStore.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final HeroRevisionContexts revisionContexts = new HeroRevisionContexts(store, contexts,
            Clock.fixed(NOW, ZoneOffset.UTC));
    private final UUID hero = UUID.randomUUID();
    private final UUID ruleset = UUID.randomUUID();
    private final UUID earlier = UUID.randomUUID();
    private final UUID later = UUID.randomUUID();
    private final UUID unpublished = UUID.randomUUID();

    @BeforeEach
    void patchVariants() {
        when(contexts.variant(earlier)).thenReturn(variant(earlier, 1, true));
        when(contexts.variant(later)).thenReturn(variant(later, 2, true));
        when(contexts.variant(unpublished)).thenReturn(variant(unpublished, 3, false));
    }

    @Test
    void withoutANamedSourceADraftCopiesTheLatestRevisionPublishedUpToItsPatch() {
        var atEarlier = revision(RevisionState.PUBLISHED, earlier, 1L);
        var atLater = revision(RevisionState.PUBLISHED, later, 2L);
        when(store.revisions(hero)).thenReturn(List.of(atLater, atEarlier));

        var source = revisionContexts.forkSource(hero, new Fork(ruleset, null, Cause.GAME_PATCH, earlier, null));

        assertThat(source.revision()).isEqualTo(atEarlier);
        assertThat(source.effective()).isEqualTo(earlier);
    }

    @Test
    void withoutANamedSourceOrPatchADraftNeedsAnActiveContext() {
        when(contexts.active(NOW)).thenReturn(List.of());

        assertThatThrownBy(() -> revisionContexts.forkSource(hero, new Fork(ruleset, null, Cause.GAME_PATCH, null,
                null))).isInstanceOf(ApiException.class)
                .hasMessage("Specify a published source when no regional context is active.");
    }

    @Test
    void onlyAPublishedRevisionCanBeCopied() {
        var draft = named(revision(RevisionState.DRAFT, earlier, null));

        assertThatThrownBy(() -> revisionContexts.forkSource(hero, new Fork(ruleset, draft.id(), Cause.GAME_PATCH,
                null, null))).isInstanceOf(ApiException.class)
                .hasMessage("The source must be published and belong to the target hero and ruleset.");
    }

    @Test
    void aDraftCannotCopyASnapshotObservedAtALaterPatch() {
        var source = named(revision(RevisionState.PUBLISHED, later, 1L));

        assertThatThrownBy(() -> revisionContexts.forkSource(hero, new Fork(ruleset, source.id(), Cause.GAME_PATCH,
                earlier, null))).isInstanceOf(ApiException.class)
                .hasMessage("A future snapshot cannot be used to reconstruct an earlier patch.");
    }

    @Test
    void aDataBaselineIsImportedRatherThanCopiedFromAnotherSnapshot() {
        var source = named(revision(RevisionState.PUBLISHED, earlier, 1L));

        assertThatThrownBy(() -> revisionContexts.forkSource(hero, new Fork(ruleset, source.id(),
                Cause.DATA_BASELINE, null, null))).isInstanceOf(ApiException.class)
                .hasMessage("Use an independent baseline import instead of copying another snapshot.");
    }

    @Test
    void aCorrectionKeepsThePatchItsSourceAppliesFrom() {
        var source = named(revision(RevisionState.PUBLISHED, earlier, 1L));

        assertThatThrownBy(() -> revisionContexts.forkSource(hero, new Fork(ruleset, source.id(),
                Cause.CONTENT_CORRECTION, later, null))).isInstanceOf(ApiException.class)
                .hasMessage("Content corrections must retain source gameplay applicability.");
    }

    @Test
    void aGamePatchRevisionNamesItsPatchVariant() {
        assertThatThrownBy(() -> revisionContexts.check(ruleset, Cause.GAME_PATCH, null, false))
                .isInstanceOf(ApiException.class).hasMessage("Game patch revisions require a patch variant.");
    }

    @Test
    void aRevisionIsPublishedOnlyOnAPublishedPatchVariant() {
        revisionContexts.check(ruleset, Cause.GAME_PATCH, unpublished, false);

        assertThatThrownBy(() -> revisionContexts.check(ruleset, Cause.GAME_PATCH, unpublished, true))
                .isInstanceOf(ApiException.class).hasMessage(
                        "The patch variant must belong to the ruleset and be published before hero publication.");
    }

    private HeroRevisionView named(HeroRevisionView revision) {
        when(store.revision(hero, revision.id())).thenReturn(revision);
        return revision;
    }

    private HeroRevisionView revision(RevisionState state, UUID effective, Long publicationSequence) {
        return new HeroRevisionView(UUID.randomUUID(), hero, ruleset, 1, state, 1, publicationSequence,
                state == RevisionState.PUBLISHED ? NOW : null, Cause.DATA_BASELINE, null, effective, Map.of());
    }

    private PatchVariantReference variant(UUID id, long ordinal, boolean published) {
        return new PatchVariantReference(id, UUID.randomUUID(), ruleset, null, ordinal, published);
    }
}
