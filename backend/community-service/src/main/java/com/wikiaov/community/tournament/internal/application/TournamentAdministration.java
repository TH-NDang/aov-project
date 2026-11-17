package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.directory.application.CompetitionDirectory;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.*;
import com.wikiaov.community.tournament.internal.directory.application.TournamentLevel;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final CompetitionDirectory directory;

    public TournamentAdministration(TeamRegistry teams, PlayerRegistry players, TournamentRegistry tournaments,
            SeriesRegistry series, GameRecords games, WikiCatalog catalog, CompetitionDirectory directory) {
        this.teams = teams;
        this.players = players;
        this.tournaments = tournaments;
        this.series = series;
        this.games = games;
        this.catalog = catalog;
        this.directory = directory;
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
    public PageSlice<TeamEntry> teamDirectory(String q, String country, String sort, Pageable page) {
        return directory.teams(q, country, sort, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<PlayerEntry> playerDirectory(String q, String country, String lane, String status, String sort,
            Pageable page) {
        return directory.players(q, country, lane, status, sort, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<CompetitionPageEntry> competitionPageStats() {
        return directory.competitionPages();
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<Ranked<Team>> teams(String q, RecordState state, String sort, UUID tournamentId, Pageable page) {
        if (state != RecordState.ACTIVE || sort.equals("UPDATED"))
            return Ranked.unranked(teams.list(q, state, page));

        return directory.rankedTeams(q, sort, tournamentId, page);
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
    public PageSlice<Ranked<Player>> players(String q, RecordState state, String sort, UUID teamId, UUID tournamentId,
            Pageable page) {
        if (state != RecordState.ACTIVE || sort.equals("UPDATED"))
            return Ranked.unranked(players.list(q, state, page));

        return directory.rankedPlayers(q, sort, teamId, tournamentId, page);
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
    public PageSlice<Ranked<Tournament>> tournaments(String q, String alsoRegions, RecordState state, String status,
            String tier, String region, Integer year, String sort, TournamentLevel level, UUID teamId, UUID playerId,
            Pageable page) {
        if (state != RecordState.ACTIVE)
            return Ranked.unranked(tournaments.list(q, state, page));

        return directory.rankedTournaments(q, alsoRegions, status, tier, region, year, sort, level, teamId, playerId,
                page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public TournamentFacets tournamentFacets(TournamentLevel level) {
        return directory.tournamentFacets(level);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public java.util.List<TournamentPart> tournamentParts(UUID mainEventId) {
        return directory.tournamentParts(mainEventId);
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
    public PageSlice<View<Series>> series(String q, UUID tournamentId, RecordState state, Pageable page) {
        return series.list(q, tournamentId, state, page);
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    public java.util.List<TournamentStats> tournamentStats() {
        return series.stats();
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
    public PageSlice<View<Game>> games(UUID seriesId, UUID tournamentId, RecordState state, Pageable page) {
        return games.list(seriesId, tournamentId, state, page);
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
        return CommunityActor.editorKey();
    }
}
