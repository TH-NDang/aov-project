package com.wikiaov.hero.internal.importing.application;

import com.wikiaov.hero.internal.application.HeroCommands;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.HeroImportRequest.Mode;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroAuthoring;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.patch.AuthoringContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import java.util.*;

/** Chooses the historical snapshot and the draft appropriate to an import mode. */
final class HeroImportRevisions {
    private final HeroAuthoring authoring;
    private final GameplayContexts contexts;

    HeroImportRevisions(HeroAuthoring authoring, GameplayContexts contexts) {
        this.authoring = authoring;
        this.contexts = contexts;
    }

    HeroRevisionView selectSnapshot(UUID heroId, HeroImportRequest input, AuthoringContext target) {
        var revisions = activeRevisions(heroId, target.rulesetId());
        var draft = revisions.stream().filter(r -> r.state().equals("DRAFT")).findFirst();
        if (draft.isPresent())
            return requireMatchingDraft(draft.get(), input.mode(), target.patchVariantId());
        var exact = latestSnapshotAt(revisions, target.patchVariantId());
        if (input.mode() == Mode.CORRECTION)
            return exact.orElse(null);
        if (exact.isPresent())
            throw new ApiException(HeroErrorCode.HERO_IMPORT_SNAPSHOT_EXISTS,
                    "This patch already has a snapshot. Choose correction mode.");
        if (input.mode() == Mode.BASELINE)
            return null;
        return latestSnapshotBefore(revisions, target.rulesetOrdinal());
    }

    private List<HeroRevisionView> activeRevisions(UUID heroId, UUID rulesetId) {
        return authoring.revisions(heroId).stream()
                .filter(r -> r.rulesetId().equals(rulesetId) && !r.state().equals("DISCARDED")).toList();
    }

    private HeroRevisionView requireMatchingDraft(HeroRevisionView draft, Mode mode, UUID patchVariantId) {
        if (!Objects.equals(draft.effectiveFromPatchVariantId(), patchVariantId) || draft.cause() != cause(mode))
            throw new ApiException(HeroErrorCode.HERO_IMPORT_DRAFT_CONFLICT,
                    "Another draft exists. Finish or discard it before changing patch or import mode.");
        return draft;
    }

    private Optional<HeroRevisionView> latestSnapshotAt(List<HeroRevisionView> revisions, UUID patchVariantId) {
        return revisions.stream().filter(r -> Objects.equals(r.effectiveFromPatchVariantId(), patchVariantId))
                .max(Comparator.comparingLong(HeroRevisionView::publicationSequence));
    }

    private HeroRevisionView latestSnapshotBefore(List<HeroRevisionView> revisions, long targetOrdinal) {
        return revisions.stream().filter(r -> r.effectiveFromPatchVariantId() != null)
                .filter(r -> contexts.variant(r.effectiveFromPatchVariantId()).rulesetOrdinal() < targetOrdinal)
                .max(Comparator
                        .<HeroRevisionView>comparingLong(
                                r -> contexts.variant(r.effectiveFromPatchVariantId()).rulesetOrdinal())
                        .thenComparingLong(HeroRevisionView::publicationSequence))
                .orElse(null);
    }

    private static Cause cause(Mode mode) {
        return switch (mode) {
            case BASELINE -> Cause.DATA_BASELINE;
            case PATCH_UPDATE -> Cause.GAME_PATCH;
            case CORRECTION -> Cause.IMPORT_CORRECTION;
        };
    }

    HeroRevisionView openDraft(HeroImportRequest input, HeroImportPlan plan) {
        if (plan.heroId() == null)
            return authoring.create(new HeroCommands.Create(input.code(), input.locale(),
                    (String) plan.after().get("name"), input.rulesetId(), input.contextId()));
        if (plan.revisionId() == null)
            return authoring.baseline(plan.heroId(), input.contextId(), input.locale(),
                    (String) plan.after().get("name"));
        var draft = authoring.read(plan.heroId(), plan.revisionId());
        if (draft.state().equals("DRAFT"))
            return draft;
        return authoring.fork(plan.heroId(), new HeroCommands.Fork(input.rulesetId(), draft.id(),
                cause(input.mode()), contexts.authoringContext(input.contextId()).patchVariantId(),
                "Imported hero fields"));
    }
}
