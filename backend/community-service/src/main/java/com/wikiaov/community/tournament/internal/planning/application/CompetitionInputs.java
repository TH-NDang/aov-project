package com.wikiaov.community.tournament.internal.planning.application;

import com.wikiaov.community.tournament.CompetitionCircuits;
import com.wikiaov.community.tournament.CompetitionOrganizations;
import com.wikiaov.community.tournament.CompetitionPeople;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.domain.CrewRules;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionResults;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionSnapshot;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerRepository;
import com.wikiaov.community.tournament.internal.registry.persistence.SeriesRepository;
import com.wikiaov.community.tournament.internal.registry.persistence.TeamRepository;
import com.wikiaov.community.tournament.internal.registry.persistence.TournamentRepository;
import com.wikiaov.community.tournament.internal.roster.persistence.RosterRepository;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

@Component
public class CompetitionInputs {
    private final TournamentRepository tournaments;
    private final TeamRepository teams;
    private final PlayerRepository players;
    private final SeriesRepository series;
    private final RosterRepository rosters;
    private final CompetitionOrganizations organizations;
    private final CompetitionCircuits circuits;
    private final CompetitionPeople people;

    public CompetitionInputs(TournamentRepository tournaments, TeamRepository teams, PlayerRepository players,
            SeriesRepository series, RosterRepository rosters, CompetitionOrganizations organizations,
            CompetitionCircuits circuits, CompetitionPeople people) {
        this.tournaments = tournaments;
        this.teams = teams;
        this.players = players;
        this.series = series;
        this.rosters = rosters;
        this.organizations = organizations;
        this.circuits = circuits;
        this.people = people;
    }

    public CompetitionSnapshot snapshot(UUID id, CompetitionPlan plan) {
        return snapshot(id, plan, false);
    }

    /** Published snapshots with the short names and introductions their circuits carry now. */
    public List<CompetitionSnapshot> described(List<CompetitionSnapshot> snapshots) {
        var circuitIds = snapshots.stream().map(CompetitionSnapshot::circuit).filter(Objects::nonNull)
                .map(CompetitionCircuits.Circuit::id).collect(Collectors.toSet());
        var about = circuits.about(circuitIds);

        return snapshots.stream().map(snapshot -> snapshot.describedBy(about)).toList();
    }

    public Map<UUID, Tournament> tournamentDetails(Collection<UUID> ids) {
        var details = new LinkedHashMap<UUID, Tournament>();
        tournaments.findAllById(ids).forEach(row -> details.put(row.getId(), row.getContent()));
        return details;
    }

    public CompetitionSnapshot snapshot(UUID id, CompetitionPlan plan, boolean publishedOrganization) {
        CompetitionOrganizations.Organization organizer = null;
        if (plan.organizerPageId() != null) {
            try {
                organizer = organizations.read(plan.organizerPageId(), publishedOrganization);
            } catch (IllegalArgumentException error) {
                throw TournamentErrors.invalid(error.getMessage());
            }
        }
        var resolvedPlan = organizer == null ? plan : plan.organizedBy(organizer.name());
        CompetitionCircuits.Circuit circuit = null;
        if (plan.circuitPageId() != null) {
            try {
                circuit = circuits.read(plan.circuitPageId(), publishedOrganization);
            } catch (IllegalArgumentException error) {
                throw TournamentErrors.invalid(error.getMessage());
            }
            resolvedPlan = resolvedPlan.inCircuit(circuit.name());
        }

        var tournament = tournaments.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(tournament);
        var teamMap = new LinkedHashMap<UUID, Team>();
        for (var entry : plan.entrants()) {
            var row = teams.findById(entry.teamId()).orElseThrow(TournamentErrors::missing);
            RegistryArchivePolicy.requireActive(row);
            teamMap.put(row.getId(), row.getContent());
        }
        var seriesMap = new LinkedHashMap<UUID, Series>();
        for (var match : plan.matches()) {
            if (match.seriesId() == null) {
                continue;
            }
            var row = series.findById(match.seriesId()).orElseThrow(TournamentErrors::missing);
            RegistryArchivePolicy.requireActive(row);
            if (!id.equals(row.getContent().tournamentId())) {
                throw TournamentErrors.invalid("Series belongs to another competition.");
            }
            seriesMap.put(row.getId(), row.getContent());
        }
        var members = rosters.search(id, null, null, "ACTIVE", Pageable.unpaged()).stream()
                .map(row -> row.getContent()).filter(row -> teamMap.containsKey(row.teamId())).toList();
        var playerIds = new LinkedHashSet<UUID>();
        members.forEach(member -> playerIds.add(member.playerId()));
        seriesMap.values().stream().map(Series::mvpPlayerId).filter(Objects::nonNull).forEach(playerIds::add);
        var playerMap = new LinkedHashMap<UUID, Player>();
        players.findAllById(playerIds).forEach(row -> playerMap.put(row.getId(), row.getContent()));
        var pageIds = new LinkedHashSet<>(CrewRules.pageIds(tournament.getContent()));
        seriesMap.values().forEach(value -> pageIds.addAll(CrewRules.pageIds(value)));
        var crew = pageIds.isEmpty()
                ? Map.<UUID, CompetitionPeople.Person>of()
                : people.read(pageIds, publishedOrganization);

        var resolved = CompetitionResults.resolve(plan, seriesMap);
        return new CompetitionSnapshot(tournament.getContent(), resolvedPlan, teamMap, playerMap, seriesMap, members,
                resolved, CompetitionResults.tables(plan, resolved), organizer, circuit, crew);
    }
}
