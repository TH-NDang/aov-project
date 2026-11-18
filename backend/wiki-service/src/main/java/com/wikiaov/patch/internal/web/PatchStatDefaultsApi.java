package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.stats.application.PatchStatDefaults.SetStatDefault;
import com.wikiaov.patch.internal.stats.application.PatchStatDefaults.StatDefaultView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;

@Tag(name = "patch stat defaults")
public interface PatchStatDefaultsApi {
    @Operation(operationId = "patchStatDefaults_effective", summary = "Read effective combat stat defaults", description = "Lists sourced defaults up to this patch in the same gameplay ruleset.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Effective defaults", useReturnTypeSchema = true))
    List<StatDefaultView> effective(UUID id, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchStatDefaults_set", summary = "Set a combat stat default", description = "Records a sourced default starting at this variant. Requires patch:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "204", description = "Default saved"))
    void set(UUID id, String key, SetStatDefault input);
}
