package com.wikiaov.community.tournament.internal.statistics.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** The public answers about what was played in a competition. */
public final class StatisticsViews {
    private StatisticsViews() {
    }

    /**
     * What the published games of a competition add up to. {@code decided} are the games with a winner, of which the
     * blue side won {@code blueWins}. The lengths are left out while no game has one.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record GameStatistics(
            int games,
            int decided,
            int blueWins,
            @Nullable Integer averageSeconds,
            @Nullable GameLength longest,
            @Nullable GameLength shortest,
            List<HeroCount> heroes,
            List<MvpCount> mvps
    ) {
    }

    public record GameLength(
            UUID id,
            int seconds
    ) {
    }

    /**
     * A hero without an id was recorded by its name only; one with an id carries the code and the picture it had in the
     * catalog, when it had them. {@code wins} are the picks of the side that won.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record HeroCount(
            @Nullable UUID id,
            @Nullable String code,
            String name,
            @Nullable String iconUrl,
            int picks,
            int wins,
            int bans,
            int bluePicks
    ) {
    }

    /** How many games a player was the MVP of. */
    public record MvpCount(
            UUID playerId,
            int games
    ) {
    }
}
