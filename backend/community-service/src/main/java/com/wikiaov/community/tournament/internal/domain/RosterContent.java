package com.wikiaov.community.tournament.internal.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Verification;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The stored documents of teams, players and the roster memberships that place a player in a team. */
public final class RosterContent {
    private RosterContent() {
    }

    public enum Lane {
        TOP,
        JUNGLE,
        MID,
        DRAGON,
        SUPPORT
    }

    public record Team(
            String code,
            String name,
            String shortName,
            String country,
            String logoUrl,
            List<String> aliases
    ) {
        public Team {
            aliases = aliases == null
                    ? List.of()
                    : aliases.stream().map(value -> value == null ? null : value.strip()).toList();
        }

        public Team(String code, String name, String shortName, String country, String logoUrl) {
            this(code, name, shortName, country, logoUrl, List.of());
        }
    }

    public record Player(
            String code,
            String nickname,
            String fullName,
            String country,
            String photoUrl,
            List<String> aliases,
            LocalDate birthDate,
            Lane lane,
            CareerStatus careerStatus,
            List<String> signatureHeroes
    ) {
        public Player {
            aliases = aliases == null
                    ? List.of()
                    : aliases.stream().map(value -> value == null ? null : value.strip()).toList();
            careerStatus = careerStatus == null ? CareerStatus.UNKNOWN : careerStatus;
            signatureHeroes = signatureHeroes == null
                    ? List.of()
                    : signatureHeroes.stream().map(value -> value == null ? null : value.strip()).toList();
        }

        public Player(String code, String nickname, String fullName, String country, String photoUrl,
                List<String> aliases) {
            this(code, nickname, fullName, country, photoUrl, aliases, null, null, null, null);
        }

        public Player(String code, String nickname, String fullName, String country) {
            this(code, nickname, fullName, country, null, List.of());
        }
    }

    public enum CareerStatus {
        ACTIVE,
        INACTIVE,
        RETIRED,
        UNKNOWN
    }

    public enum RosterStatus {
        ACTIVE,
        SUBSTITUTE,
        INACTIVE,
        UNKNOWN
    }

    public record RosterMembership(
            UUID tournamentId,
            UUID teamId,
            UUID playerId,
            Lane lane,
            String jerseyNumber,
            RosterStatus status,
            LocalDate startsOn,
            LocalDate endsOn,
            String sourceUrl,
            Verification verification,
            String note
    ) {
        public RosterMembership {
            jerseyNumber = jerseyNumber == null ? null : jerseyNumber.strip();
            status = status == null ? RosterStatus.UNKNOWN : status;
            verification = verification == null ? Verification.UNVERIFIED : verification;
        }
    }
}
