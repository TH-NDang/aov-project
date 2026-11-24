package com.wikiaov.community.tournament.internal.reference.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentTier;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** The parts of a published snapshot that name something or say who took part. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PublishedCompetition(
        UUID id,
        Event tournament,
        @Nullable Circuit circuit,
        Map<UUID, Team> teams,
        Map<UUID, Player> players,
        Map<UUID, Person> people,
        List<Seat> rosters,
        List<Duty> crews
) {
    /** Snapshots taken before ADR-032 have no people and no crews. */
    public PublishedCompetition {
        teams = teams == null ? Map.of() : teams;
        players = players == null ? Map.of() : players;
        people = people == null ? Map.of() : people;
        rosters = rosters == null ? List.of() : rosters;
        crews = crews == null ? List.of() : crews;
    }

    /** {@code staff} and {@code broadcast} serve the whole competition, the {@code crews} beside them its matches. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Event(
            String name,
            @Nullable String region,
            @Nullable TournamentTier tier,
            @Nullable LocalDate startsOn,
            @Nullable LocalDate endsOn,
            @Nullable String logoUrl,
            @Nullable String logoDarkUrl,
            List<Duty> staff,
            List<Duty> broadcast
    ) {
        public Event {
            staff = staff == null ? List.of() : staff;
            broadcast = broadcast == null ? List.of() : broadcast;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Circuit(
            UUID id,
            String name
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Team(
            String name,
            @Nullable String shortName,
            List<String> aliases,
            @Nullable String country,
            @Nullable String logoUrl,
            @Nullable String logoDarkUrl
    ) {
        public Team {
            aliases = aliases == null ? List.of() : aliases;
        }
    }

    /** {@code fullName} is read only to keep it out of the names a text can use. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Player(
            String nickname,
            @Nullable String fullName,
            List<String> aliases,
            @Nullable String country
    ) {
        public Player {
            aliases = aliases == null ? List.of() : aliases;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Person(
            String name
    ) {
    }

    /** A player's place in a team's roster. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Seat(
            UUID playerId,
            UUID teamId
    ) {
    }

    /** What a person did, and for which team when they were on its staff. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Duty(
            UUID pageId,
            @Nullable String role,
            @Nullable UUID teamId
    ) {
    }
}
