package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia.References;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia.Usage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;

@Tag(name = "competition media")
public interface CompetitionMediaApi {
    @Operation(operationId = "competitionMediaApi_usage", summary = "Read the usage of an image")
    Usage usage(UUID assetId);

    @Operation(operationId = "competitionMediaApi_references", summary = "Count the records naming each image")
    References references();

    @Operation(operationId = "competitionMediaApi_retire", summary = "Retire an unused image")
    Usage retire(UUID assetId);
}
