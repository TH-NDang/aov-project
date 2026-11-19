package com.wikiaov.community.tournament.internal.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The stored documents of tournaments and the series played in them, with their results. Teams, players and rosters
 * are in {@link RosterContent}, games in {@link GameContent}.
 */
public final class TournamentContent {
    private TournamentContent() {
    }

    /**
     * {@code parentTournamentId} makes this tournament a part of a main event: its qualifier, wildcard, weekly stop or
     * show match. A part keeps its own teams, format, schedule and final table; a main event names no parent.
     */
    public record Tournament(
            String code,
            String name,
            String region,
            Integer year,
            LocalDate startsOn,
            LocalDate endsOn,
            String sourceUrl,
            String note,
            String logoUrl,
            TournamentTier tier,
            CompetitionType competitionType,
            VenueMode venueMode,
            TournamentStatus status,
            TournamentResult result,
            String localCurrency,
            List<TournamentPlacement> placements,
            List<TournamentAward> awards,
            List<TournamentLink> links,
            UUID parentTournamentId
    ) {
        public Tournament {
            tier = tier == null ? TournamentTier.UNKNOWN : tier;
            competitionType = competitionType == null ? CompetitionType.UNKNOWN : competitionType;
            venueMode = venueMode == null ? VenueMode.UNKNOWN : venueMode;
            status = status == null ? TournamentStatus.UNKNOWN : status;
            placements = placements == null ? List.of() : List.copyOf(placements);
            awards = awards == null ? List.of() : List.copyOf(awards);
            links = links == null ? List.of() : List.copyOf(links);
        }

        public Tournament(String code, String name, String region, Integer year, LocalDate startsOn,
                LocalDate endsOn, String sourceUrl, String note, String logoUrl, TournamentTier tier,
                CompetitionType competitionType, VenueMode venueMode, TournamentStatus status,
                TournamentResult result, String localCurrency, List<TournamentPlacement> placements,
                List<TournamentAward> awards, List<TournamentLink> links) {
            this(code, name, region, year, startsOn, endsOn, sourceUrl, note, logoUrl, tier, competitionType,
                    venueMode, status, result, localCurrency, placements, awards, links, null);
        }

        public Tournament(String code, String name, String region, Integer year, LocalDate startsOn,
                LocalDate endsOn, String sourceUrl, String note, String logoUrl, TournamentTier tier,
                CompetitionType competitionType, VenueMode venueMode, TournamentStatus status,
                TournamentResult result) {
            this(code, name, region, year, startsOn, endsOn, sourceUrl, note, logoUrl, tier, competitionType,
                    venueMode, status, result, null, null, null, null);
        }

        public Tournament(String code, String name, String region, Integer year, LocalDate startsOn,
                LocalDate endsOn, String sourceUrl, String note) {
            this(code, name, region, year, startsOn, endsOn, sourceUrl, note, null, null, null, null, null, null);
        }
    }

    public enum TournamentTier {
        S,
        A,
        B,
        C,
        D,
        UNKNOWN
    }

    /**
     * One line of a tournament's final table. {@code teamId} links a registered team when one is known;
     * {@code teamName} stays readable either way. {@code place} is text because a line can be shared ("5-8").
     */
    public record TournamentPlacement(
            String place,
            UUID teamId,
            String teamName,
            BigDecimal prizeUsd,
            BigDecimal prizeLocal,
            String lastOpponent,
            String lastScore
    ) {
    }

    /** An individual or team prize such as MVP; {@code playerId} links a registered player when one is known. */
    public record TournamentAward(
            String title,
            UUID playerId,
            String recipientName,
            String teamName,
            BigDecimal prizeUsd,
            BigDecimal prizeLocal
    ) {
    }

    public record TournamentLink(
            String label,
            String url
    ) {
    }

    public enum CompetitionType {
        LEAGUE,
        CUP,
        QUALIFIER,
        SHOWMATCH,
        OTHER,
        UNKNOWN
    }

    public enum VenueMode {
        ONLINE,
        OFFLINE,
        HYBRID,
        UNKNOWN
    }

    public enum TournamentStatus {
        UPCOMING,
        ONGOING,
        FINISHED,
        ANNOUNCED,
        UNKNOWN
    }

    public enum Verification {
        PRIMARY,
        SECONDARY_CORROBORATED,
        SECONDARY_CAPTURE,
        SECONDARY_PRESS_ONLY,
        UNVERIFIED
    }

    public record TournamentResult(
            String winnerName,
            String runnerUpName,
            Integer winnerScore,
            Integer runnerUpScore,
            String sourceUrl,
            Verification verification,
            LocalDate verifiedOn
    ) {
        public TournamentResult {
            winnerName = winnerName == null ? null : winnerName.strip();
            runnerUpName = runnerUpName == null ? null : runnerUpName.strip();
            verification = verification == null ? Verification.UNVERIFIED : verification;
        }
    }

    public record Series(
            String code,
            UUID tournamentId,
            String name,
            String stage,
            UUID teamAId,
            UUID teamBId,
            Integer bestOf,
            Instant scheduledAt,
            String sourceUrl,
            String note,
            SeriesResult result,
            boolean repeatPicksAllowed,
            @Nullable MatchTitle title
    ) {
        /**
         * A series without a title: {@code name} alone says what it is. {@code repeatPicksAllowed}: this match was
         * played without the rule against re-picking a hero.
         */
        public Series(String code, UUID tournamentId, String name, String stage, UUID teamAId, UUID teamBId,
                Integer bestOf, Instant scheduledAt, String sourceUrl, String note, SeriesResult result,
                boolean repeatPicksAllowed) {
            this(code, tournamentId, name, stage, teamAId, teamBId, bestOf, scheduledAt, sourceUrl, note, result,
                    repeatPicksAllowed, null);
        }

        public Series(String code, UUID tournamentId, String name, String stage, UUID teamAId, UUID teamBId,
                Integer bestOf, Instant scheduledAt, String sourceUrl, String note, SeriesResult result) {
            this(code, tournamentId, name, stage, teamAId, teamBId, bestOf, scheduledAt, sourceUrl, note, result,
                    false);
        }

        public Series(String code, UUID tournamentId, String name, String stage, UUID teamAId, UUID teamBId,
                Integer bestOf, Instant scheduledAt, String sourceUrl, String note) {
            this(code, tournamentId, name, stage, teamAId, teamBId, bestOf, scheduledAt, sourceUrl, note, null);
        }
    }

    public record SeriesResult(
            Integer scoreA,
            Integer scoreB,
            String sourceUrl,
            Verification verification,
            LocalDate verifiedOn
    ) {
        public SeriesResult {
            verification = verification == null ? Verification.UNVERIFIED : verification;
        }
    }
}
