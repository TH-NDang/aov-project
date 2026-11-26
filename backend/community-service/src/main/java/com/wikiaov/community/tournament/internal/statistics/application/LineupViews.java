package com.wikiaov.community.tournament.internal.statistics.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** The public answers about who picked, banned and built what in the games of a competition. */
public final class LineupViews {
    private LineupViews() {
    }

    /**
     * Every published game of a competition in short. Games name heroes and players by their place in the two lists, so
     * one answer holds a whole season.
     */
    public record Lineups(
            List<LineupHero> heroes,
            List<LineupPlayer> players,
            List<LineupGame> games
    ) {
    }

    /** A hero without an id was recorded by its name only. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LineupHero(
            @Nullable UUID id,
            @Nullable String code,
            String name,
            @Nullable String iconUrl
    ) {
    }

    /** {@code name} is the nickname in the newest game that knew one: a roster does not name everybody who played. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LineupPlayer(
            UUID id,
            @Nullable String name
    ) {
    }

    /** {@code seconds} is left out while the length is not known, {@code mvp} while the game names none. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LineupGame(
            UUID id,
            UUID seriesId,
            @Nullable Integer number,
            @Nullable Side winner,
            @Nullable Integer seconds,
            @Nullable Integer mvp,
            @Nullable LineupTeam blue,
            @Nullable LineupTeam red
    ) {
    }

    /**
     * Picks come by lane, those without one last; bans by their turn, those without one in the order recorded. A game
     * whose two sides list no ban is one whose bans nobody wrote down.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LineupTeam(
            @Nullable UUID teamId,
            List<LineupPick> picks,
            List<LineupBan> bans
    ) {
    }

    /** {@code turn} is the place of the pick among all turns of the draft, where the order was recorded. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LineupPick(
            int hero,
            @Nullable Lane lane,
            @Nullable Integer player,
            @Nullable Integer turn
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LineupBan(
            int hero,
            @Nullable Integer turn
    ) {
    }

    /**
     * What a hero was played with in a competition. Builds name their parts by their place in the lists; a pick whose
     * source showed none of it has no build.
     */
    public record HeroBuilds(
            List<BuildPart> spells,
            List<BuildPart> enchantments,
            List<BuildPart> items,
            List<Build> builds
    ) {
        public static final HeroBuilds NONE = new HeroBuilds(List.of(), List.of(), List.of(), List.of());
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record BuildPart(
            @Nullable UUID id,
            String name,
            @Nullable String iconUrl,
            @Nullable Integer tier
    ) {
    }

    /**
     * {@code enchantment} is the main one. {@code items} are those held to the end, {@code replaced} those given up on
     * the way and {@code situational} those bought for a moment of the game.
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    public record Build(
            UUID gameId,
            @Nullable Integer spell,
            @Nullable Integer enchantment,
            @JsonInclude List<Integer> items,
            List<Integer> replaced,
            List<Integer> situational
    ) {
    }
}
