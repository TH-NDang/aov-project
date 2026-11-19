package com.wikiaov.hero.internal.authoring.application;

import com.wikiaov.hero.internal.application.HeroCommands.Fork;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.patch.AuthoringContext;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.util.Comparator;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Which patch a hero revision applies to: the published revision a new draft copies, the patch the draft then applies
 * from, and where an initial baseline may move. Earlier patches never read content observed at a later one.
 */
@Component
public class HeroRevisionContexts {
    private final HeroStore store;
    private final GameplayContexts contexts;
    private final Clock clock;

    public HeroRevisionContexts(HeroStore store, GameplayContexts contexts, Clock clock) {
        this.store = store;
        this.contexts = contexts;
        this.clock = clock;
    }

    /** The published revision a draft copies and the patch variant the draft applies from. */
    record ForkSource(
            HeroRevisionView revision,
            @Nullable UUID effective
    ) {
    }

    ForkSource forkSource(UUID heroId, Fork input) {
        var source = input.sourceRevisionId() == null
                ? defaultSource(heroId, input)
                : store.revision(heroId, input.sourceRevisionId());
        if (!source.rulesetId().equals(input.rulesetId()) || source.state() != RevisionState.PUBLISHED) {
            throw HeroValidation.invalid("The source must be published and belong to the target hero and ruleset.");
        }

        UUID effective = input.effectiveFromPatchVariantId() == null
                ? source.effectiveFromPatchVariantId()
                : input.effectiveFromPatchVariantId();
        check(input.rulesetId(), input.cause(), effective, false);
        if (effective != null && ordinal(source) > contexts.variant(effective).rulesetOrdinal()) {
            throw HeroValidation.invalid("A future snapshot cannot be used to reconstruct an earlier patch.");
        }
        if (input.cause() == Cause.DATA_BASELINE) {
            throw HeroValidation.invalid("Use an independent baseline import instead of copying another snapshot.");
        }
        if (input.cause() != Cause.GAME_PATCH && !Objects.equals(effective, source.effectiveFromPatchVariantId())) {
            throw HeroValidation.invalid("Content corrections must retain source gameplay applicability.");
        }
        return new ForkSource(source, effective);
    }

    /** The observation context an initial baseline draft moves to; a published history keeps it in place. */
    AuthoringContext baselineTarget(UUID heroId, HeroRevisionView draft, UUID contextId) {
        if (draft.cause() != Cause.DATA_BASELINE || draft.sourceRevisionId() != null) {
            throw HeroValidation
                    .invalid("Only an independent initial baseline draft can change its observation context.");
        }
        if (store.revisions(heroId).stream().anyMatch(revision -> revision.rulesetId().equals(draft.rulesetId())
                && revision.state() == RevisionState.PUBLISHED)) {
            throw HeroValidation.invalid("A published history exists. Create a separate historical baseline instead.");
        }
        var target = contexts.authoringContext(contextId);
        if (!target.rulesetId().equals(draft.rulesetId())) {
            throw HeroValidation.invalid("The baseline observation context must keep the same ruleset.");
        }
        return target;
    }

    /** A game patch or baseline names its patch variant, which belongs to the ruleset and, to publish, is published. */
    void check(UUID ruleset, Cause cause, @Nullable UUID effective, boolean published) {
        contexts.requireRuleset(ruleset);
        if (effective == null) {
            if (cause == Cause.GAME_PATCH || cause == Cause.DATA_BASELINE) {
                throw HeroValidation.invalid("Game patch revisions require a patch variant.");
            }
            return;
        }
        var variant = contexts.variant(effective);
        if (!variant.rulesetId().equals(ruleset) || (published && !variant.published())) {
            throw HeroValidation
                    .invalid("The patch variant must belong to the ruleset and be published before hero publication.");
        }
    }

    private HeroRevisionView defaultSource(UUID heroId, Fork input) {
        long limit = input.effectiveFromPatchVariantId() == null
                ? contexts.active(clock.instant()).stream().filter(c -> c.rulesetId().equals(input.rulesetId()))
                        .mapToLong(GameplayContext::rulesetOrdinal).max()
                        .orElseThrow(() -> HeroValidation
                                .invalid("Specify a published source when no regional context is active."))
                : contexts.variant(input.effectiveFromPatchVariantId()).rulesetOrdinal();
        return store.revisions(heroId).stream().filter(
                r -> r.rulesetId().equals(input.rulesetId()) && r.state() == RevisionState.PUBLISHED
                        && ordinal(r) <= limit)
                .max(Comparator.<HeroRevisionView>comparingLong(this::ordinal)
                        .thenComparingLong(HeroRevisionView::publicationSequence))
                .orElseThrow(() -> HeroValidation.invalid("A published source revision is required."));
    }

    private long ordinal(HeroRevisionView revision) {
        return revision.effectiveFromPatchVariantId() == null
                ? 0
                : contexts.variant(revision.effectiveFromPatchVariantId()).rulesetOrdinal();
    }
}
