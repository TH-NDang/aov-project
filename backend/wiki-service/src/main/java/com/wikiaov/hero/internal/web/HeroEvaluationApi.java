package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroEvaluationCommands.UpdateNotesCommand;
import com.wikiaov.hero.internal.authoring.application.HeroEvaluationCommands.UpdateTraitsCommand;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero admin")
public interface HeroEvaluationApi {
    @Operation(operationId = "heroEvaluationApi_updateTraits", summary = "Replace a draft's traits", description = "Stores the full list of yes/no traits an editor confirmed from the skill kit (ADR-029). Traits belong to the draft's skills section and are published with it; a skill update keeps them. Each trait may name skills of the same set and carry one detail line per locale. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView updateTraits(@Parameter(description = "Hero or hero form identifier.") UUID heroId,
            @Parameter(description = "Draft identifier.") UUID draftId, @Valid UpdateTraitsCommand body);

    @Operation(operationId = "heroEvaluationApi_updateNotes", summary = "Write a draft's notes", description = "Stores strengths, weaknesses and counter tips of one profile locale (ADR-029); blank text clears a note. A profile update keeps the notes. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView updateNotes(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Draft identifier.") UUID draftId, @Valid UpdateNotesCommand body);
}
