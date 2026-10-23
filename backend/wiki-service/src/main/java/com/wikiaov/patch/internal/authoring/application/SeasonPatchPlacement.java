package com.wikiaov.patch.internal.authoring.application;

import com.wikiaov.patch.internal.application.PatchCommands.*;
import com.wikiaov.patch.internal.application.PatchCommands.SeasonPatch;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.SeasonVariant;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.season.application.RankedSeasons;
import com.wikiaov.platform.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Chooses a patch's position while holding the ruleset's shared insertion lock. */
@Component
class SeasonPatchPlacement {
    private final GameplayRulesetRepository rulesets;
    private final PatchVariantRepository variants;
    private final RankedSeasons seasons;

    SeasonPatchPlacement(GameplayRulesetRepository rulesets, PatchVariantRepository variants, RankedSeasons seasons) {
        this.rulesets = rulesets;
        this.variants = variants;
        this.seasons = seasons;
    }

    record Placement(
            long appendOrdinal,
            UUID beforeVariantId
    ) {
    }

    Placement choosePlacement(SeasonPatch input) {
        rulesets.lockById(input.rulesetId()).orElseThrow(SeasonPatchPlacement::notFound);
        var season = seasons.require(input.seasonId());
        var ordered = variants.orderedSeasonVariants(input.rulesetId());
        UUID anchor = input.beforeVariantId() == null
                ? firstPatchInLaterSeason(ordered, season.getOrdinal())
                : requireAnchorInSameSeason(input);
        long appendOrdinal = ordered.isEmpty() ? 1 : Math.addExact(ordered.getLast().rulesetOrdinal(), 1);
        return new Placement(appendOrdinal, anchor);
    }

    private UUID requireAnchorInSameSeason(SeasonPatch input) {
        var anchor = variants.lockById(input.beforeVariantId()).orElseThrow(SeasonPatchPlacement::notFound);
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

    private static ApiException notFound() {
        return new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "Patch resource does not exist.");
    }
}
