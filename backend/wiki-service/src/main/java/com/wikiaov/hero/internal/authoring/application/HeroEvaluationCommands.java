package com.wikiaov.hero.internal.authoring.application;

import com.wikiaov.hero.internal.domain.HeroContent.Trait;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Requests of the hero evaluation parts of a draft (ADR-029). The schema names stay those of the former
 * {@code web.request.HeroEvaluationRequests} records, so the published OpenAPI document does not change.
 */
public final class HeroEvaluationCommands {
    private HeroEvaluationCommands() {
    }

    /** The full list of confirmed traits; an empty list clears them. */
    @Schema(name = "com.wikiaov.hero.internal.web.request.HeroEvaluationRequests.TraitsRequest")
    public record UpdateTraitsCommand(
            @NotNull @Positive Long expectedDraftVersion,
            @NotNull @Size(max = 32) List<@NotNull @Valid Trait> traits,
            @Size(max = 4000) String changeNote
    ) {
    }

    /** The notes of one profile locale; blank text clears a note. */
    @Schema(name = "com.wikiaov.hero.internal.web.request.HeroEvaluationRequests.NotesRequest")
    public record UpdateNotesCommand(
            @NotNull @Positive Long expectedDraftVersion,
            @NotBlank @Size(max = 16) String locale,
            @Size(max = 4000) String strengths,
            @Size(max = 4000) String weaknesses,
            @Size(max = 4000) String counterTips,
            @Size(max = 4000) String changeNote
    ) {
    }
}
