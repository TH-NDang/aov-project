package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.PublicTournamentQueries.Summary;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RequestMapping(version = "1")
public interface TournamentPublicApi {
    @GetMapping(ApiPaths.ROOT + "/catalog")
    Catalog catalog(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request);

    @GetMapping(ApiPaths.ROOT + "/games")
    PageSlice<PublishedGame> games(@RequestParam(required = false) UUID tournamentId,
            @RequestParam(required = false) UUID seriesId,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ROOT + "/games/{id}")
    PublishedGame game(@PathVariable UUID id, HttpServletRequest request);

    @GetMapping(ApiPaths.ROOT + "/tournaments")
    PageSlice<Summary<Tournament>> tournaments(
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "24") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ROOT + "/series")
    PageSlice<Summary<Series>> series(@RequestParam(required = false) UUID tournamentId,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "24") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);
}
