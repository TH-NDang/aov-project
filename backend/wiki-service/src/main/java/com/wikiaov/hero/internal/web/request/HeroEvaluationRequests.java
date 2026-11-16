package com.wikiaov.hero.internal.web.request;

import com.wikiaov.hero.internal.domain.HeroContent.Trait;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

/** Requests of the hero evaluation parts of a draft (ADR-029). */
public final class HeroEvaluationRequests {
    private HeroEvaluationRequests() {
    }

    /** The full list of confirmed traits; an empty list clears them. */
    public record TraitsRequest(
            @NotNull @Positive Long expectedDraftVersion,
            @NotNull @Size(max = 32) List<@NotNull @Valid Trait> traits,
            @Size(max = 4000) String changeNote
    ) {
    }

    /** The notes of one profile locale; blank text clears a note. */
    public record NotesRequest(
            @NotNull @Positive Long expectedDraftVersion,
            @NotBlank @Size(max = 16) String locale,
            @Size(max = 4000) String strengths,
            @Size(max = 4000) String weaknesses,
            @Size(max = 4000) String counterTips,
            @Size(max = 4000) String changeNote
    ) {
    }
}
