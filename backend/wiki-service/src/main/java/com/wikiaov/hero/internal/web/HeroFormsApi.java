package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroCommands.ReplaceForms;
import com.wikiaov.hero.internal.application.response.HeroFormsView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero admin")
public interface HeroFormsApi {
    @Operation(operationId = "heroFormsApi_read", summary = "Read a hero's forms", description = "The form switcher of a hero (ADR-024): the hero that holds the forms and each form in order, with the names and roles of each newest draft or published revision. Works from the holding hero and from any of its forms; a hero without forms returns no holder and no forms. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroFormsView read(
            @Parameter(description = "Hero identifier: a holding hero, a form or any other hero.") UUID heroId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroFormsApi_replace", summary = "Replace a hero's forms", description = "Sets the complete ordered list of forms a hero holds; the first is the default form. Applies at once without a draft. Each form's code must be the hero code followed by '-' and the form key, forms are one level deep, and the hero must hold no roles, positions, ratings, stats or skills. expectedForms must match the current list, otherwise HERO_FORMS_CONFLICT. Requires hero:publish.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroFormsView replace(@Parameter(description = "Identifier of the hero that holds the forms.") UUID heroId,
            @Valid ReplaceForms body);
}
