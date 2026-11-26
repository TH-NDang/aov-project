package com.wikiaov.community.tournament.internal.statistics.application;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.games.domain.GameRules;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.Known;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.Seat;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;

/**
 * The heroes the games of one competition name. The games come newest first: a hero keeps the first name, code and
 * picture met. Imported games name some heroes without their id; such a hero is the one hero with an id that these
 * games know by the same name, and a name two of them go by tells nothing.
 */
final class HeroRoll {
    private final Map<String, Hero> heroes = new LinkedHashMap<>();

    private HeroRoll() {
    }

    static HeroRoll of(List<PublishedLineup> newestFirst) {
        var roll = new HeroRoll();
        for (var game : newestFirst) {
            for (var side : game.sides()) {
                Stream.concat(side.seats().stream().map(Seat::hero), side.bans().stream()).filter(HeroRoll::present)
                        .forEach(selection -> roll.add(game, selection));
            }
        }
        roll.joinNamed();

        return roll;
    }

    static boolean present(@Nullable Selection selection) {
        return selection != null && selection.present();
    }

    /** The hero that a selection of these games names; null for a selection none of them holds. */
    @Nullable
    Hero hero(Selection selection) {
        return heroes.get(GameRules.identity(selection));
    }

    private void add(PublishedLineup game, Selection selection) {
        var hero = heroes.computeIfAbsent(GameRules.identity(selection), identity -> new Hero(selection.id()));
        var catalog = game.catalog().heroes();
        var name = Known.nameOf(catalog, selection);
        if (hero.name.isEmpty()) {
            hero.name = name;
        }
        Known.of(catalog, selection).ifPresent(hero::picture);
        Stream.of(name, Objects.requireNonNullElse(selection.name(), "")).filter(known -> !known.isBlank())
                .map(known -> GameRules.identity(new Selection(null, known))).forEach(hero.names::add);
    }

    private void joinNamed() {
        var byName = new HashMap<>(heroes.values().stream().filter(hero -> hero.id != null)
                .flatMap(hero -> hero.names.stream().map(name -> Map.entry(name, hero)))
                .collect(Collectors.groupingBy(Map.Entry::getKey,
                        Collectors.mapping(Map.Entry::getValue, Collectors.toList()))));

        heroes.replaceAll((identity, hero) -> {
            var known = hero.id == null ? byName.getOrDefault(identity, List.of()) : List.<Hero>of();
            return known.size() == 1 ? known.getFirst() : hero;
        });
    }

    /** One object per hero, so two selections that name the same hero find the same one. */
    static final class Hero {
        private final @Nullable UUID id;
        private final Set<String> names = new HashSet<>();
        private String name = "";
        private @Nullable String code;
        private @Nullable String iconUrl;

        private Hero(@Nullable UUID id) {
            this.id = id;
        }

        private void picture(Known known) {
            code = code == null || code.isBlank() ? known.code() : code;
            iconUrl = iconUrl == null || iconUrl.isBlank() ? known.iconUrl() : iconUrl;
        }

        @Nullable
        UUID id() {
            return id;
        }

        String name() {
            return name;
        }

        @Nullable
        String code() {
            return code;
        }

        @Nullable
        String iconUrl() {
            return iconUrl;
        }
    }
}
