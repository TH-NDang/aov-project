package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.catalog.application.WikiCatalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.PublishedGame;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.games.application.PublicTournamentQueries;
import com.wikiaov.community.tournament.internal.games.application.PublicTournamentQueries.Summary;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TournamentPublicController implements TournamentPublicApi {
    private final PublicTournamentQueries queries;
    private final WikiCatalog catalog;

    public TournamentPublicController(PublicTournamentQueries queries, WikiCatalog catalog) {
        this.queries = queries;
        this.catalog = catalog;
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/catalog", version = "1")
    public Catalog catalog(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        return catalog.read(region, locale, seasonId, patchVariantId, includeUnscoped);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/games", version = "1")
    public PageSlice<PublishedGame> games(@RequestParam(required = false) @Nullable UUID tournamentId,
            @RequestParam(required = false) @Nullable UUID seriesId,
            @RequestParam(required = false) @Nullable UUID heroId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("tournamentId", "seriesId", "heroId", "page", "size"));
        return queries.games(tournamentId, seriesId, heroId, PageRequest.of(page, size));
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/games/{id}", version = "1")
    public PublishedGame game(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return queries.game(id);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/tournaments", version = "1")
    public PageSlice<Summary<Tournament>> tournaments(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return queries.tournaments(Parameters.pageable(page, size, "publishedAt"));
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/series", version = "1")
    public PageSlice<Summary<Series>> series(@RequestParam(required = false) UUID tournamentId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("tournamentId", "page", "size"));
        return queries.series(tournamentId, Parameters.pageable(page, size, "publishedAt"));
    }
}
