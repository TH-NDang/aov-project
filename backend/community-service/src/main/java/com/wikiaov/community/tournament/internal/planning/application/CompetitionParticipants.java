package com.wikiaov.community.tournament.internal.planning.application;

import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.CompetitionPeople.Person;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRepository;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRepository.ParticipantRow;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** The teams, players and personnel readers meet in published competitions, whether or not they have a public page. */
@Service
public class CompetitionParticipants {
    private final CompetitionPlanRepository plans;
    private final JsonMapper json;

    public CompetitionParticipants(CompetitionPlanRepository plans, JsonMapper json) {
        this.plans = plans;
        this.json = json;
    }

    public enum Kind {
        TEAM("teams"),
        PLAYER("players"),
        /** Broadcast crews and team staff; the id is the one of their profile page. */
        PERSON("people");

        private final String collection;

        Kind(String collection) {
            this.collection = collection;
        }
    }

    /**
     * A team, player or person as the newest published competition names it, {@code competitions} of them in all. A
     * player carries the team of that competition's roster; a person the team they worked for and what they did. People
     * carry neither a picture nor a real name.
     */
    public record Participant(
            UUID id,
            Kind kind,
            String name,
            @Nullable String shortName,
            @Nullable String country,
            @Nullable String imageUrl,
            @Nullable String imageDarkUrl,
            int competitions,
            UUID competitionId,
            String competitionName,
            @Nullable ParticipantTeam team,
            List<String> roles
    ) {
    }

    public record ParticipantTeam(
            UUID id,
            String name,
            @Nullable String shortName,
            @Nullable String logoUrl,
            @Nullable String logoDarkUrl
    ) {
    }

    @Transactional(readOnly = true)
    public PageSlice<Participant> list(Kind kind, @Nullable String query, @Nullable String country, int page,
            int size) {
        var wanted = text(query);
        var region = text(country);
        var slice = PageRequest.of(page, size);

        var rows = plans.participants(kind.collection, wanted, region, size, slice.getOffset());
        var found = PageableExecutionUtils.getPage(rows, slice,
                () -> plans.countParticipants(kind.collection, wanted, region));

        return PageSlice.from(found.map(row -> switch (kind) {
            case TEAM -> team(row);
            case PLAYER -> player(row);
            case PERSON -> person(row);
        }));
    }

    private Participant team(ParticipantRow row) {
        var team = json.readValue(row.getContent(), Team.class);

        return new Participant(row.getId(), Kind.TEAM, team.name(), team.shortName(), team.country(), team.logoUrl(),
                team.logoDarkUrl(), row.getCompetitions(), row.getCompetitionId(), row.getCompetitionName(), null,
                List.of());
    }

    private Participant player(ParticipantRow row) {
        var player = json.readValue(row.getContent(), Player.class);

        return new Participant(row.getId(), Kind.PLAYER, player.nickname(), null, player.country(), null, null,
                row.getCompetitions(), row.getCompetitionId(), row.getCompetitionName(), side(row), List.of());
    }

    private Participant person(ParticipantRow row) {
        var person = json.readValue(row.getContent(), Person.class);
        var roles = row.getRoles() == null ? List.<String>of() : List.of(row.getRoles().split(","));

        return new Participant(row.getId(), Kind.PERSON, person.name(), null, null, null, null, row.getCompetitions(),
                row.getCompetitionId(), row.getCompetitionName(), side(row), roles);
    }

    private @Nullable ParticipantTeam side(ParticipantRow row) {
        if (row.getTeamId() == null || row.getTeam() == null) {
            return null;
        }
        var team = json.readValue(row.getTeam(), Team.class);

        return new ParticipantTeam(row.getTeamId(), team.name(), team.shortName(), team.logoUrl(),
                team.logoDarkUrl());
    }

    private static String text(@Nullable String value) {
        return value == null ? "" : value.strip();
    }
}
