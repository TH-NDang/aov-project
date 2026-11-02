package com.wikiaov.community.tournament.internal.planning.application;

import com.wikiaov.community.tournament.CompetitionOrganizations;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import com.wikiaov.community.tournament.internal.persistence.*;
import com.wikiaov.community.tournament.internal.planning.domain.*;
import com.wikiaov.community.tournament.internal.roster.persistence.RosterRepository;
import java.util.*;
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

    public CompetitionInputs(TournamentRepository tournaments, TeamRepository teams, PlayerRepository players,
            SeriesRepository series, RosterRepository rosters, CompetitionOrganizations organizations) {
        this.tournaments = tournaments;
        this.teams = teams;
        this.players = players;
        this.series = series;
        this.rosters = rosters;
        this.organizations = organizations;
    }

    public CompetitionSnapshot snapshot(UUID id, CompetitionPlan plan) {
        return snapshot(id, plan, false);
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
            if (match.seriesId() == null)
                continue;
            var row = series.findById(match.seriesId()).orElseThrow(TournamentErrors::missing);
            RegistryArchivePolicy.requireActive(row);
            if (!id.equals(row.getContent().tournamentId()))
                throw TournamentErrors.invalid("Series belongs to another competition.");
            seriesMap.put(row.getId(), row.getContent());
        }
        var members = rosters.search(id, null, null, "ACTIVE", Pageable.unpaged()).stream()
                .map(row -> row.getContent()).filter(row -> teamMap.containsKey(row.teamId())).toList();
        var playerMap = new LinkedHashMap<UUID, Player>();
        players.findAllById(members.stream().map(RosterMembership::playerId).distinct().toList())
                .forEach(row -> playerMap.put(row.getId(), row.getContent()));
        var resolved = CompetitionResults.resolve(plan, seriesMap);
        return new CompetitionSnapshot(tournament.getContent(), resolvedPlan, teamMap, playerMap, seriesMap, members,
                resolved, CompetitionResults.tables(plan, resolved), organizer);
    }
}
