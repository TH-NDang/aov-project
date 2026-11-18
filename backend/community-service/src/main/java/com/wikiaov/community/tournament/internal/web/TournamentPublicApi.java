package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.PublicTournamentQueries.Summary;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.PublishedGame;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;

@Tag(name = "tournaments")
public interface TournamentPublicApi {
    @Operation(operationId = "tournamentPublicApi_catalog", summary = "Read the game catalog")
    Catalog catalog(String region, String locale, UUID seasonId, UUID patchVariantId, boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentPublicApi_games", summary = "List published games")
    PageSlice<PublishedGame> games(UUID tournamentId, UUID seriesId,
            @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentPublicApi_game", summary = "Read a published game")
    PublishedGame game(UUID id, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentPublicApi_tournaments", summary = "List tournaments with published games")
    PageSlice<Summary<Tournament>> tournaments(@Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @Min(1) @Max(PageLimits.MAX_SIZE) int size, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "tournamentPublicApi_series", summary = "List series with published games")
    PageSlice<Summary<Series>> series(UUID tournamentId, @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @Min(1) @Max(PageLimits.MAX_SIZE) int size, @Parameter(hidden = true) HttpServletRequest request);
}
