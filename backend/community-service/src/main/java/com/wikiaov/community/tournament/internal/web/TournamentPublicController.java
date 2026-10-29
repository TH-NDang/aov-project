package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.application.PublicTournamentQueries;
import com.wikiaov.community.tournament.internal.application.PublicTournamentQueries.Summary;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.application.WikiCatalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class TournamentPublicController implements TournamentPublicApi {
    private final PublicTournamentQueries queries;
    private final WikiCatalog catalog;

    public TournamentPublicController(PublicTournamentQueries queries, WikiCatalog catalog) {
        this.queries = queries;
        this.catalog = catalog;
    }

    @Override
    public Catalog catalog(String region, String locale, UUID seasonId, UUID patchVariantId, boolean includeUnscoped,
            HttpServletRequest request) {
        Parameters.only(request, "region", "locale", "seasonId", "patchVariantId", "includeUnscoped");
        return catalog.read(region, locale, seasonId, patchVariantId, includeUnscoped);
    }

    @Override
    public PageSlice<PublishedGame> games(UUID tournamentId, UUID seriesId, int page, int size,
            HttpServletRequest request) {
        Parameters.only(request, "tournamentId", "seriesId", "page", "size");
        return queries.games(tournamentId, seriesId, Parameters.page(page, size, "published_at"));
    }

    @Override
    public PublishedGame game(UUID id) {
        return queries.game(id);
    }

    @Override
    public PageSlice<Summary<Tournament>> tournaments(int page, int size, HttpServletRequest request) {
        Parameters.only(request, "page", "size");
        return queries.tournaments(Parameters.page(page, size, "publishedAt"));
    }

    @Override
    public PageSlice<Summary<Series>> series(UUID tournamentId, int page, int size, HttpServletRequest request) {
        Parameters.only(request, "tournamentId", "page", "size");
        return queries.series(tournamentId, Parameters.page(page, size, "publishedAt"));
    }
}
