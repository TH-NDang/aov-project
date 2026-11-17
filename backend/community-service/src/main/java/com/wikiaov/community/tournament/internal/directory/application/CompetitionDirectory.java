package com.wikiaov.community.tournament.internal.directory.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.platform.PlatformErrorCode;
import com.wikiaov.community.tournament.internal.application.TournamentViews;
import com.wikiaov.community.tournament.internal.application.TournamentViews.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Ranked;
import com.wikiaov.community.tournament.internal.directory.application.DirectoryViews.*;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryRepository;
import com.wikiaov.community.tournament.internal.directory.persistence.DirectoryRepository.*;
import com.wikiaov.community.tournament.internal.domain.ReferenceLabels;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.CareerStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentTier;
import com.wikiaov.community.tournament.internal.persistence.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * Read model behind the admin directories. The ranked page of ids comes from {@link DirectoryRepository}; the typed
 * records are then loaded by id, so documents are parsed in one place and only for the rows on screen.
 */
@Service
public class CompetitionDirectory {
    private static final Set<String> TEAM_SORTS = Set.of("RECENT", "TOURNAMENTS", "TITLES", "PRIZE", "NAME");
    private static final Set<String> PLAYER_SORTS = Set.of("RECENT", "TOURNAMENTS", "TITLES", "NAME");
    private static final Set<String> RECORD_SORTS = Set.of("RECENT", "NAME");
    private static final Set<String> TOURNAMENT_SORTS = Set.of("RECENT", "STATUS", "NAME", "UPDATED");
    private static final int LINEUP_LIMIT = 7;

    private final DirectoryRepository directory;
    private final TeamRepository teams;
    private final PlayerRepository players;
    private final TournamentRepository tournaments;

    public CompetitionDirectory(DirectoryRepository directory, TeamRepository teams, PlayerRepository players,
            TournamentRepository tournaments) {
        this.directory = directory;
        this.teams = teams;
        this.players = players;
        this.tournaments = tournaments;
    }

    public PageSlice<PlayerEntry> players(String q, String country, String lane, String status, String sort,
            Pageable page) {
        requireOneOf("sort", sort, PLAYER_SORTS);
        requireEnum("lane", lane, Lane.class);
        requireEnum("status", status, CareerStatus.class);

        var rows = directory.players(ReferenceLabels.literalSearch(q), q, country, lane, status, sort, unsorted(page));
        var people = byId(players.findAllById(rows.map(PlayerRow::getId).toList()), PlayerRecord::getId);
        var latestTeams = byId(teams.findAllById(rows.map(PlayerRow::getTeamId).filter(Objects::nonNull).toSet()),
                TeamRecord::getId);
        var latest = byId(
                tournaments.findAllById(rows.map(PlayerRow::getTournamentId).filter(Objects::nonNull).toSet()),
                TournamentRecord::getId);

        return PageSlice.from(rows.map(row -> {
            var content = people.get(row.getId()).getContent();
            return new PlayerEntry(row.getId(), content.code(), content.nickname(), content.fullName(),
                    content.country(), content.photoUrl(), content.birthDate(), parseLane(row.getLane()),
                    content.careerStatus(), content.signatureHeroes(), row.getTournaments(), row.getTitles(),
                    teamRef(latestTeams.get(row.getTeamId())), tournamentRef(latest.get(row.getTournamentId())),
                    row.getLastActiveOn());
        }));
    }

    public PageSlice<TeamEntry> teams(String q, String country, String sort, Pageable page) {
        requireOneOf("sort", sort, TEAM_SORTS);

        var rows = directory.teams(ReferenceLabels.literalSearch(q), q, country, sort, unsorted(page));
        var records = byId(teams.findAllById(rows.map(TeamRow::getId).toList()), TeamRecord::getId);
        var latest = byId(tournaments.findAllById(rows.map(TeamRow::getTournamentId).filter(Objects::nonNull).toSet()),
                TournamentRecord::getId);
        var lineups = lineups(rows.map(TeamRow::getId).toList());

        return PageSlice.from(rows.map(row -> {
            var content = records.get(row.getId()).getContent();
            var lineup = lineups.get(row.getId());
            return new TeamEntry(row.getId(), content.code(), content.name(), content.shortName(), content.country(),
                    content.logoUrl(), row.getTournaments(), row.getMatches(), row.getWins(), row.getLosses(),
                    row.getTitles(), row.getPrizeUsd(), tournamentRef(latest.get(row.getTournamentId())),
                    lineup == null ? List.of() : lineup.members(), lineup == null ? null : lineup.tournament(),
                    row.getLastActiveOn());
        }));
    }

    public PageSlice<Ranked<Team>> rankedTeams(String q, String sort, UUID tournamentId, Pageable page) {
        requireOneOf("sort", sort, RECORD_SORTS);

        var rows = directory.rankedTeams(ReferenceLabels.literalSearch(q), q, sort, text(tournamentId), unsorted(page));
        var records = byId(teams.findAllById(rows.map(RankedRow::getId).toList()), TeamRecord::getId);

        return PageSlice.from(rows.map(row -> {
            var record = records.get(row.getId());
            return new Ranked<>(TournamentViews.view(record, record.getContent()), row.getLastActiveOn(),
                    row.getContext());
        }));
    }

    public PageSlice<Ranked<Player>> rankedPlayers(String q, String sort, UUID teamId, UUID tournamentId,
            Pageable page) {
        requireOneOf("sort", sort, RECORD_SORTS);

        var rows = directory.rankedPlayers(ReferenceLabels.literalSearch(q), q, sort, text(teamId), text(tournamentId),
                unsorted(page));
        var records = byId(players.findAllById(rows.map(RankedRow::getId).toList()), PlayerRecord::getId);

        return PageSlice.from(rows.map(row -> {
            var record = records.get(row.getId());
            return new Ranked<>(TournamentViews.view(record, record.getContent()), row.getLastActiveOn(),
                    row.getContext());
        }));
    }

    public PageSlice<Ranked<Tournament>> rankedTournaments(String q, String alsoRegions, String status, String tier,
            String region, Integer year, String sort, TournamentLevel level, UUID teamId, UUID playerId,
            Pageable page) {
        requireOneOf("sort", sort, TOURNAMENT_SORTS);
        requireEnum("status", status, TournamentStatus.class);
        requireEnum("tier", tier, TournamentTier.class);

        var rows = directory.rankedTournaments(q, alsoRegions, status, tier, region,
                year == null ? "" : year.toString(), sort, level.mainEventsOnly(), text(teamId), text(playerId),
                unsorted(page));
        var records = byId(tournaments.findAllById(rows.map(RankedRow::getId).toList()), TournamentRecord::getId);

        return PageSlice.from(rows.map(row -> {
            var record = records.get(row.getId());
            return new Ranked<>(TournamentViews.view(record, record.getContent()), null, row.getContext());
        }));
    }

    /** The parts of one main event, or every part when no main event is named. */
    public List<TournamentPart> tournamentParts(UUID mainEventId) {
        var ids = directory.tournamentParts(text(mainEventId));
        var records = byId(tournaments.findAllById(ids), TournamentRecord::getId);

        return ids.stream().map(records::get).map(row -> {
            var part = row.getContent();
            return new TournamentPart(row.getId(), part.parentTournamentId(), part.name(), part.logoUrl(),
                    part.competitionType(), part.status(), part.tier(), part.region(), part.startsOn(), part.endsOn());
        }).toList();
    }

    public TournamentFacets tournamentFacets(TournamentLevel level) {
        var rows = directory.tournamentFacets(level.mainEventsOnly());
        var statuses = rows.stream().filter(row -> row.getFacet().equals("STATUS"))
                .collect(Collectors.toMap(FacetRow::getValue, FacetRow::getRows));
        var regions = rows.stream().filter(row -> row.getFacet().equals("REGION")).map(FacetRow::getValue).sorted()
                .toList();
        var years = rows.stream().filter(row -> row.getFacet().equals("YEAR"))
                .map(row -> Integer.valueOf(row.getValue())).sorted(Comparator.reverseOrder()).toList();

        return new TournamentFacets(statuses.values().stream().mapToLong(Long::longValue).sum(), statuses, regions,
                years);
    }

    public List<CompetitionPageEntry> competitionPages() {
        var rows = directory.competitionPages();
        var latest = byId(
                tournaments.findAllById(rows.stream().map(CompetitionPageRow::getLatestTournamentId).toList()),
                TournamentRecord::getId);

        return rows.stream().map(row -> new CompetitionPageEntry(row.getPageId(), row.getTournaments(),
                row.getFirstYear(), row.getLastYear(), parseTiers(row.getTiers()),
                tournamentRef(latest.get(row.getLatestTournamentId())))).toList();
    }

    /** The most recent roster each team has on record; its latest tournament may have none entered yet. */
    private Map<UUID, Lineup> lineups(List<UUID> teamIds) {
        if (teamIds.isEmpty())
            return Map.of();

        var teamList = teamIds.stream().map(UUID::toString).collect(Collectors.joining(","));
        var current = directory.lineups(teamList).stream()
                .filter(line -> parseStatus(line.getStatus()) != RosterStatus.INACTIVE)
                .collect(Collectors.groupingBy(LineupRow::getTeamId));
        var latestLines = current.values().stream().map(CompetitionDirectory::latestTournamentLines).toList();
        var people = byId(players.findAllById(latestLines.stream().flatMap(List::stream)
                .map(LineupRow::getPlayerId).collect(Collectors.toSet())), PlayerRecord::getId);
        var shown = byId(tournaments.findAllById(latestLines.stream()
                .map(lines -> lines.getFirst().getTournamentId()).collect(Collectors.toSet())),
                TournamentRecord::getId);

        return latestLines.stream().collect(Collectors.toMap(lines -> lines.getFirst().getTeamId(), lines -> {
            var members = lines.stream().map(line -> member(line, people.get(line.getPlayerId()).getContent()))
                    .sorted(LINEUP_ORDER).limit(LINEUP_LIMIT).toList();
            return new Lineup(members, tournamentRef(shown.get(lines.getFirst().getTournamentId())));
        }));
    }

    private static List<LineupRow> latestTournamentLines(List<LineupRow> lines) {
        var latest = lines.stream().max(Comparator.comparingInt(LineupRow::getDay)
                .thenComparing(LineupRow::getTournamentId)).orElseThrow();
        return lines.stream().filter(line -> line.getTournamentId().equals(latest.getTournamentId())).toList();
    }

    private static LineupMember member(LineupRow line, Player player) {
        var lane = line.getLane() == null ? player.lane() : parseLane(line.getLane());
        return new LineupMember(line.getPlayerId(), player.nickname(), player.photoUrl(), lane,
                parseStatus(line.getStatus()));
    }

    private record Lineup(
            List<LineupMember> members,
            TournamentRef tournament
    ) {
    }

    private static final Comparator<LineupMember> LINEUP_ORDER = Comparator
            .comparing((LineupMember member) -> member.status() == RosterStatus.SUBSTITUTE)
            .thenComparing(LineupMember::lane, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(LineupMember::name, String.CASE_INSENSITIVE_ORDER);

    private static String text(UUID id) {
        return id == null ? "" : id.toString();
    }

    private static Pageable unsorted(Pageable page) {
        return PageRequest.of(page.getPageNumber(), page.getPageSize());
    }

    private static <T> Map<UUID, T> byId(List<T> rows, Function<T, UUID> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity()));
    }

    private static TeamRef teamRef(TeamRecord row) {
        if (row == null)
            return null;

        var team = row.getContent();
        return new TeamRef(row.getId(), team.name(), team.shortName(), team.logoUrl());
    }

    private static TournamentRef tournamentRef(TournamentRecord row) {
        if (row == null)
            return null;

        var tournament = row.getContent();
        return new TournamentRef(row.getId(), tournament.name(), tournament.logoUrl(), tournament.tier(),
                tournament.year(), tournament.startsOn(), tournament.endsOn());
    }

    private static Lane parseLane(String value) {
        return value == null ? null : Lane.valueOf(value);
    }

    private static RosterStatus parseStatus(String value) {
        return value == null ? RosterStatus.UNKNOWN : RosterStatus.valueOf(value);
    }

    private static List<TournamentTier> parseTiers(String tiers) {
        if (tiers == null)
            return List.of();

        return Arrays.stream(tiers.split(",")).map(TournamentTier::valueOf).sorted().toList();
    }

    private static void requireOneOf(String name, String value, Set<String> allowed) {
        if (!allowed.contains(value)) {
            throw unsupported(name, value);
        }
    }

    private static <E extends Enum<E>> void requireEnum(String name, String value, Class<E> type) {
        if (value.isEmpty())
            return;

        try {
            Enum.valueOf(type, value);
        } catch (IllegalArgumentException invalid) {
            throw unsupported(name, value);
        }
    }

    /** A list option the client sent that the list does not have is a bad query parameter, not bad content. */
    private static ApiException unsupported(String name, String value) {
        return new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Unsupported " + name + ": " + value);
    }
}
