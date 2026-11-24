package com.wikiaov.community.tournament.internal.directory.application;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.CareerStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.CompetitionType;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentTier;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class DirectoryViews {
    private DirectoryViews() {
    }

    public record TeamRef(
            UUID id,
            String name,
            String shortName,
            String logoUrl,
            String logoDarkUrl
    ) {
    }

    public record TournamentRef(
            UUID id,
            String name,
            String logoUrl,
            String logoDarkUrl,
            TournamentTier tier,
            Integer year,
            LocalDate startsOn,
            LocalDate endsOn
    ) {
    }

    /** One line of a team's most recent roster. */
    public record LineupMember(
            UUID playerId,
            String name,
            String photoUrl,
            Lane lane,
            RosterStatus status
    ) {
    }

    /** Player with the team and tournament of their most recent roster line, not a claim about today's contract. */
    public record PlayerEntry(
            UUID id,
            String code,
            String nickname,
            String fullName,
            String country,
            String photoUrl,
            LocalDate birthDate,
            Lane lane,
            CareerStatus careerStatus,
            List<String> signatureHeroes,
            long tournaments,
            long titles,
            TeamRef latestTeam,
            TournamentRef latestTournament,
            LocalDate lastActiveOn
    ) {
    }

    public record TeamEntry(
            UUID id,
            String code,
            String name,
            String shortName,
            String country,
            String logoUrl,
            String logoDarkUrl,
            long tournaments,
            long matches,
            long wins,
            long losses,
            long titles,
            BigDecimal prizeUsd,
            TournamentRef latestTournament,
            List<LineupMember> lineup,
            TournamentRef lineupTournament,
            LocalDate lastActiveOn
    ) {
    }

    /** A part of a main event as a tab or a list line shows it; opening the part reads its full record. */
    public record TournamentPart(
            UUID id,
            UUID parentId,
            String name,
            String logoUrl,
            String logoDarkUrl,
            CompetitionType competitionType,
            TournamentStatus status,
            TournamentTier tier,
            String region,
            LocalDate startsOn,
            LocalDate endsOn
    ) {
    }

    /**
     * What a list of tournaments can be narrowed by: how many tournaments each value would leave beside the search and
     * the other filters. A value that would leave none is missing. {@code total} counts every tournament of the level.
     */
    public record TournamentFacets(
            long total,
            Map<String, Long> statuses,
            Map<String, Long> tiers,
            Map<String, Long> regions,
            Map<String, Long> years
    ) {
    }

    /** What the team directory can be narrowed by, counted like {@link TournamentFacets}. */
    public record TeamFacets(
            Map<String, Long> countries
    ) {
    }

    /** What the player directory can be narrowed by, counted like {@link TournamentFacets}. */
    public record PlayerFacets(
            Map<String, Long> countries,
            Map<String, Long> lanes,
            Map<String, Long> statuses
    ) {
    }

    /** Tournaments gathered under an organizer's or a circuit's page. */
    public record CompetitionPageEntry(
            UUID pageId,
            long tournaments,
            Integer firstYear,
            Integer lastYear,
            List<TournamentTier> tiers,
            TournamentRef latestTournament
    ) {
    }
}
