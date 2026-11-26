package com.wikiaov.community.tournament.internal.statistics.application;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildPlace;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.games.domain.GameRules;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.Build;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.BuildPart;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.HeroBuilds;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.Known;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.Seat;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.SeatEnchantment;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;

/** Lists what each hero of a competition was played with (spec 04, builds of a hero in a competition). */
final class BuildList {
    private static final Comparator<SeatEnchantment> MAIN_FIRST = Comparator.comparing(SeatEnchantment::tier,
            Comparator.nullsFirst(Comparator.naturalOrder()));

    private final Parts spells = new Parts();
    private final Parts enchantments = new Parts();
    private final Parts items = new Parts();
    private final List<Build> builds = new ArrayList<>();

    private BuildList() {
    }

    /** The builds of every hero with an id, by that id. */
    static Map<UUID, HeroBuilds> of(List<PublishedLineup> newestFirst, HeroRoll heroes) {
        var lists = new HashMap<UUID, BuildList>();
        for (var game : newestFirst) {
            for (var side : game.sides()) {
                for (var seat : side.seats()) {
                    var hero = HeroRoll.present(seat.hero()) ? heroes.hero(seat.hero()) : null;
                    if (hero != null && hero.id() != null) {
                        lists.computeIfAbsent(hero.id(), id -> new BuildList()).add(game, seat);
                    }
                }
            }
        }

        var builds = new HashMap<UUID, HeroBuilds>();
        lists.forEach((hero, list) -> builds.put(hero, list.views()));
        return Map.copyOf(builds);
    }

    private void add(PublishedLineup game, Seat seat) {
        var catalog = game.catalog();
        var spell = spells.place(catalog.spells(), seat.spell());
        var enchantment = seat.enchantments().stream().filter(entry -> entry.primary() && present(entry.selection()))
                .max(MAIN_FIRST).map(entry -> enchantments.place(catalog.enchantments(), entry.selection()))
                .orElse(null);
        var build = new Build(game.id(), spell, enchantment, items(game, seat, BuildPlace.KEPT),
                items(game, seat, BuildPlace.REPLACED), items(game, seat, BuildPlace.SITUATIONAL));
        boolean shown = spell != null || enchantment != null
                || Stream.of(build.items(), build.replaced(), build.situational()).anyMatch(list -> !list.isEmpty());

        if (shown) {
            builds.add(build);
        }
    }

    private List<Integer> items(PublishedLineup game, Seat seat, BuildPlace place) {
        return game.items(seat, place).stream().filter(BuildList::present)
                .map(item -> items.place(game.catalog().items(), item)).toList();
    }

    private HeroBuilds views() {
        return new HeroBuilds(spells.views(), enchantments.views(), items.views(), List.copyOf(builds));
    }

    private static boolean present(@Nullable Selection selection) {
        return HeroRoll.present(selection);
    }

    /** The parts met so far. The games come newest first: a part keeps the first name and picture met. */
    private static final class Parts {
        private final Map<String, Part> parts = new LinkedHashMap<>();

        private @Nullable Integer place(List<Known> catalog, @Nullable Selection selection) {
            if (!present(selection)) {
                return null;
            }
            var part = parts.computeIfAbsent(GameRules.identity(selection),
                    identity -> new Part(parts.size(), selection.id()));
            part.meet(Known.nameOf(catalog, selection), Known.of(catalog, selection).orElse(null));

            return part.place;
        }

        private List<BuildPart> views() {
            return parts.values().stream().map(part -> new BuildPart(part.id, part.name, part.iconUrl, part.tier))
                    .toList();
        }
    }

    private static final class Part {
        private final int place;
        private final @Nullable UUID id;
        private String name = "";
        private @Nullable String iconUrl;
        private @Nullable Integer tier;

        private Part(int place, @Nullable UUID id) {
            this.place = place;
            this.id = id;
        }

        private void meet(String knownAs, @Nullable Known known) {
            name = name.isEmpty() ? knownAs : name;
            if (known != null) {
                iconUrl = iconUrl == null || iconUrl.isBlank() ? known.iconUrl() : iconUrl;
                tier = tier == null ? known.tier() : tier;
            }
        }
    }
}
