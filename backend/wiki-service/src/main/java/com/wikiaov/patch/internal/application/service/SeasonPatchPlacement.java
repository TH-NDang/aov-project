package com.wikiaov.patch.internal.application.service;

import com.wikiaov.patch.internal.application.PatchCommands.SeasonPatch;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.PatchStore;
import com.wikiaov.patch.internal.persistence.PatchStore.SeasonVariant;
import com.wikiaov.patch.internal.persistence.entity.PatchVariant;
import com.wikiaov.platform.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Chooses a patch's position while holding the ruleset's shared insertion lock. */
@Component
class SeasonPatchPlacement {
    private final PatchStore store;
    private final RankedSeasons seasons;

    SeasonPatchPlacement(PatchStore store, RankedSeasons seasons) {
        this.store = store;
        this.seasons = seasons;
    }

    record Placement(
            long appendOrdinal,
            UUID beforeVariantId
    ) {
    }

    Placement choosePlacement(SeasonPatch input) {
        store.lockRuleset(input.rulesetId());
        var season = seasons.require(input.seasonId());
        var ordered = store.orderedSeasonVariants(input.rulesetId());
        UUID anchor = input.beforeVariantId() == null
                ? firstPatchInLaterSeason(ordered, season.getOrdinal())
                : requireAnchorInSameSeason(input);
        long appendOrdinal = ordered.isEmpty() ? 1 : Math.addExact(ordered.getLast().rulesetOrdinal(), 1);
        return new Placement(appendOrdinal, anchor);
    }

    private UUID requireAnchorInSameSeason(SeasonPatch input) {
        var anchor = store.lock(PatchVariant.class, input.beforeVariantId());
        if (!input.rulesetId().equals(anchor.getRulesetId()) || !input.seasonId().equals(anchor.getSeasonId()))
            throw new ApiException(PatchErrorCode.PATCH_INVALID,
                    "Choose an insertion anchor in the same season and ruleset.");
        return input.beforeVariantId();
    }

    private UUID firstPatchInLaterSeason(List<SeasonVariant> ordered, long seasonOrdinal) {
        return ordered.stream()
                .filter(variant -> variant.seasonOrdinal() != null && variant.seasonOrdinal() > seasonOrdinal)
                .map(SeasonVariant::id).findFirst().orElse(null);
    }
}
