package com.wikiaov.community.tournament.internal.statistics.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;

/**
 * A published game cut down to what the statistics of its competition count. {@code heroes} are the heroes of the
 * catalog published with it.
 */
public record PublishedLineup(
        UUID id,
        Instant publishedAt,
        @Nullable Side winner,
        @Nullable Integer durationSeconds,
        @Nullable UUID mvpPlayerId,
        List<LineupSide> sides,
        List<KnownHero> heroes
) {
    public PublishedLineup {
        sides = sides == null ? List.of() : sides;
        heroes = heroes == null ? List.of() : heroes;
    }

    /** A hero of the catalog, as it was when the game was published. */
    public record KnownHero(
            UUID id,
            @Nullable String code,
            @Nullable String name,
            @Nullable String iconUrl
    ) {
    }

    /** A selection may be missing or empty: a ban that was not used or not seen. */
    public record LineupSide(
            Side side,
            List<@Nullable Selection> bans,
            List<@Nullable Selection> picks
    ) {
        public LineupSide {
            bans = bans == null ? List.of() : bans;
            picks = picks == null ? List.of() : picks;
        }
    }

    /**
     * The name this game shows for a hero: the one of its catalog, otherwise the one recorded. Empty when the game
     * knows the hero by its id alone.
     */
    public String nameOf(Selection hero) {
        return Stream.concat(known(hero).map(KnownHero::name).stream(), Stream.ofNullable(hero.name()))
                .filter(Objects::nonNull).map(String::strip).filter(name -> !name.isEmpty()).findFirst().orElse("");
    }

    /** The hero of the game's catalog that a selection names by its id. */
    public Optional<KnownHero> known(Selection hero) {
        return heroes.stream().filter(known -> hero.id() != null && hero.id().equals(known.id())).findFirst();
    }
}
