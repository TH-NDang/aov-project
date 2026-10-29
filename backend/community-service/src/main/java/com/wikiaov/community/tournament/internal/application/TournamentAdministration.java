package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TournamentAdministration {
    private final TeamRegistry teams;
    private final PlayerRegistry players;
    private final TournamentRegistry tournaments;
    private final SeriesRegistry series;
    private final GameRecords games;
    private final WikiCatalog catalog;

    public TournamentAdministration(TeamRegistry teams, PlayerRegistry players, TournamentRegistry tournaments,
            SeriesRegistry series, GameRecords games, WikiCatalog catalog) {
        this.teams = teams;
        this.players = players;
        this.tournaments = tournaments;
        this.series = series;
        this.games = games;
        this.catalog = catalog;
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    public Map<String, Object> me() {
        return Map.of("capabilities", SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .map(Object::toString).filter(value -> value.startsWith("tournament:")).sorted().toList());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    public Catalog catalog(String region, String locale, UUID season, UUID patch, boolean unscoped) {
        return catalog.read(region, locale, season, patch, unscoped);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<View<Team>> teams(String q, RecordState state, Pageable page) {
        return teams.list(q, state, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Team> getTeam(UUID id) {
        return teams.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Team> createTeam(Team content) {
        return teams.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Team> updateTeam(UUID id, Long version, Team content) {
        return teams.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<View<Player>> players(String q, RecordState state, Pageable page) {
        return players.list(q, state, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Player> getPlayer(UUID id) {
        return players.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Player> createPlayer(Player content) {
        return players.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Player> updatePlayer(UUID id, Long version, Player content) {
        return players.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<View<Tournament>> tournaments(String q, RecordState state, Pageable page) {
        return tournaments.list(q, state, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Tournament> getTournament(UUID id) {
        return tournaments.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Tournament> createTournament(Tournament content) {
        return tournaments.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Tournament> updateTournament(UUID id, Long version, Tournament content) {
        return tournaments.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<View<Series>> series(String q, RecordState state, Pageable page) {
        return series.list(q, state, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Series> getSeries(UUID id) {
        return series.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Series> createSeries(Series content) {
        return series.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Series> updateSeries(UUID id, Long version, Series content) {
        return series.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<View<Game>> games(UUID seriesId, RecordState state, Pageable page) {
        return games.list(seriesId, state, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<Game> getGame(UUID id) {
        return games.get(id);
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Game> createGame(Game content) {
        return games.create(content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    @Transactional
    public View<Game> updateGame(UUID id, Long version, Game content) {
        return games.update(id, version, content, actor());
    }

    @PreAuthorize("hasAuthority('tournament:publish')")
    public View<Game> publishGame(UUID id, Long version) {
        var draft = games.get(id);
        TournamentErrors.version(draft.version(), version);
        var content = draft.content();
        // Resolve external wiki references before entering the publication transaction.
        var references = catalog.read(content.region() == null ? "VN" : content.region(),
                content.locale() == null ? "vi-VN" : content.locale(), content.seasonId(), content.patchVariantId(),
                content.includeUnscoped());
        return games.publish(id, version, references, actor());
    }

    @PreAuthorize("hasAuthority('tournament:publish')")
    @Transactional
    public View<Game> withdrawGame(UUID id, Long version) {
        return games.withdraw(id, version, actor());
    }

    private static String actor() {
        var auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        return auth.getToken().getIssuer() + "|" + auth.getToken().getSubject();
    }
}
