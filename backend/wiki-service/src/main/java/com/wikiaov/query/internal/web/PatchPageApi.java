package com.wikiaov.query.internal.web;

import com.wikiaov.patch.PublishedPatch;
import com.wikiaov.platform.PageLimits;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.query.internal.application.PatchChangesPage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "patch page")
public interface PatchPageApi {

    @Operation(operationId = "patchPageApi_list", summary = "List - patch page", description = "One page of the patches released in a market. Public read endpoint. Unrecognized query parameters are rejected. A patch without a translation leaves out its text fields.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    ResponseEntity<PageSlice<PublishedPatch>> list(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchPageApi_detail", summary = "Detail - patch page", description = "One patch released in a market. Public read endpoint. Unrecognized query parameters are rejected. A patch without a translation leaves out its text fields.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    ResponseEntity<PublishedPatch> detail(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchPageApi_changes", summary = "Changes - patch page", description = "One page of the changes a patch made to one domain, with the patch. Public read endpoint. Unrecognized query parameters are rejected. Hero items follow the hero change history; other domains send their own change rows.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    ResponseEntity<PatchChangesPage> changes(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Public patch change domain. Only published gameplay changes are included. Existing hero details and spell removal events retain their format.", schema = @Schema(allowableValues = {
                    "HERO", "SPELL", "ITEM", "ENCHANTMENT",
                    "ARCANA"})) @Pattern(regexp = "HERO|SPELL|ITEM|ENCHANTMENT|ARCANA") String domain,
            @Parameter(description = "Optional published variant from the regional catalog, including undated variants.") UUID patchVariantId,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);
}
