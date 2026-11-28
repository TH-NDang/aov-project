package com.wikiaov.community.tournament.internal.statistics.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildPlace;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildRole;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildStep;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.Build;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.BuildPart;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.HeroBuilds;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.Catalog;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.Known;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.LineupSide;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.Seat;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.SeatEnchantment;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.SeatInventory;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.SeatSlot;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

class BuildListTest {
    private static final UUID FLORENTINO = UUID.randomUUID();
    private static final UUID FLICKER = UUID.randomUUID();
    private static final UUID BLADE = UUID.randomUUID();
    private static final int LENGTH = 900;

    @Test
    void aBuildNamesItsPartsByTheirPlaceInTheLists() {
        var game = game(Catalog.EMPTY, seat(FLORENTINO, new Selection(FLICKER, "Flicker"),
                List.of(main("Courage", 3)), List.of(slot("Blade"), slot("Boots"))));

        var builds = builds(game);

        assertThat(builds.spells()).containsExactly(new BuildPart(FLICKER, "Flicker", null, null));
        assertThat(builds.enchantments()).containsExactly(new BuildPart(null, "Courage", null, null));
        assertThat(builds.items()).extracting(BuildPart::name).containsExactly("Blade", "Boots");
        assertThat(builds.builds()).containsExactly(new Build(game.id(), 0, 0, List.of(0, 1), List.of(), List.of()));
    }

    @Test
    void theMainEnchantmentIsThePrimaryOneOfTheHighestTier() {
        var game = game(Catalog.EMPTY, seat(FLORENTINO, null,
                List.of(main("First tier", 1), main("Third tier", 3), other("Side branch", 3)), List.of()));

        assertThat(builds(game).enchantments()).extracting(BuildPart::name).containsExactly("Third tier");
    }

    @Test
    void aSlotThatWasNotSeenIsNoItem() {
        var game = game(Catalog.EMPTY, seat(FLORENTINO, null, List.of(),
                List.of(new SeatSlot(new Selection(null, "Guess"), false), new SeatSlot(null, true), slot("Blade"))));

        assertThat(builds(game).items()).extracting(BuildPart::name).containsExactly("Blade");
    }

    @Test
    void aBuildThatWasWrittenDownIsReadInsteadOfTheLastInventory() {
        var game = game(Catalog.EMPTY, seat(FLORENTINO, null, List.of(), List.of(slot("Blade"), slot("Boots")),
                core("Axe"), core("Blade")));

        assertThat(builds(game).items()).extracting(BuildPart::name).containsExactly("Axe", "Blade");
    }

    @Test
    void anInventoryShownBeforeTheEndOfTheGameIsNoBuild() {
        var seat = seat(FLORENTINO, null, List.of(), List.of(slot("Blade")));

        assertThat(builds(game(LENGTH + 60, Catalog.EMPTY, seat)).items()).hasSize(1);
        assertThat(builds(game(LENGTH + 61, Catalog.EMPTY, seat)).items()).isEmpty();
        assertThat(builds(game(null, Catalog.EMPTY, seat)).items()).isEmpty();
    }

    @Test
    void anInventoryAtSecondZeroOfAGameOfZeroSecondsIsNoBuild() {
        var seat = seat(FLORENTINO, null, List.of(), new SeatInventory(0, List.of(slot("Blade"))));

        assertThat(builds(game(0, Catalog.EMPTY, seat)).items()).isEmpty();
    }

    @Test
    void protectiveItemsAndSoldOnesAreKeptApartWhileThoseThatWentIntoOthersAreLeftOut() {
        var game = game(Catalog.EMPTY, seat(FLORENTINO, null, List.of(), List.of(), core("Spear"), core("Boots"),
                new BuildStep(item("Lance"), List.of(item("Spear")), List.of(), BuildRole.CORE, false, null),
                new BuildStep(item("Revive"), List.of(), List.of(item("Boots")), BuildRole.PROTECTIVE, false, null),
                new BuildStep(item("Orb"), List.of(), List.of(), BuildRole.PROTECTIVE, true, null)));

        assertThat(builds(game).items()).extracting(BuildPart::name)
                .containsExactly("Boots", "Lance", "Revive", "Orb");
        assertThat(builds(game).builds()).containsExactly(
                new Build(game.id(), null, null, List.of(0, 1), List.of(2, 3), List.of(0, 3)));
    }

    @Test
    void aBuildOfTheFirstListsIsReadAsItIsWrittenNow() {
        var game = game(Catalog.EMPTY, seat(FLORENTINO, null, List.of(), List.of(),
                legacy("Spear", BuildPlace.REPLACED), legacy("Boots", BuildPlace.REPLACED),
                new BuildStep(item("Lance"), List.of(item("Spear")), null, null, false, null, BuildPlace.KEPT),
                legacy("Revive", BuildPlace.SITUATIONAL)));

        assertThat(builds(game).items()).extracting(BuildPart::name).containsExactly("Boots", "Lance", "Revive");
        assertThat(builds(game).builds()).containsExactly(
                new Build(game.id(), null, null, List.of(0, 1), List.of(2), List.of(0)));
    }

    @Test
    void aBuildOfNothingButProtectiveItemsIsStillABuild() {
        var game = game(Catalog.EMPTY, seat(FLORENTINO, null, List.of(), List.of(),
                new BuildStep(item("Revive"), List.of(), List.of(), BuildRole.PROTECTIVE, false, null)));

        assertThat(builds(game).builds()).hasSize(1);
    }

    @Test
    void aPickWhoseSourceShowedNothingHasNoBuild() {
        var game = game(Catalog.EMPTY, seat(FLORENTINO, null, List.of(), List.of()));

        assertThat(builds(game).builds()).isEmpty();
    }

    @Test
    void aPartTakesItsNameAndPictureFromTheNewestCatalogThatHasThem() {
        var item = new SeatSlot(new Selection(BLADE, "Recorded name"), true);
        var newer = game(catalogItem(new Known(BLADE, "blade", "Blade", null, 3)),
                seat(FLORENTINO, null, List.of(), List.of(item)));
        var older = game(catalogItem(new Known(BLADE, "blade", "Old blade", "https://img/blade.png", 2)),
                seat(FLORENTINO, null, List.of(), List.of(item)));

        assertThat(builds(newer, older).items())
                .containsExactly(new BuildPart(BLADE, "Blade", "https://img/blade.png", 3));
    }

    @Test
    void theBuildsOfOneHeroAreKeptApartFromThoseOfAnother() {
        var other = UUID.randomUUID();
        var game = game(Catalog.EMPTY, seat(FLORENTINO, null, List.of(), List.of(slot("Blade"))),
                seat(other, null, List.of(), List.of(slot("Boots"))));
        var games = List.of(game);

        var builds = BuildList.of(games, HeroRoll.of(games));

        assertThat(builds.get(FLORENTINO).items()).extracting(BuildPart::name).containsExactly("Blade");
        assertThat(builds.get(other).items()).extracting(BuildPart::name).containsExactly("Boots");
    }

    private static HeroBuilds builds(PublishedLineup... games) {
        var lineups = List.of(games);

        return BuildList.of(lineups, HeroRoll.of(lineups)).get(FLORENTINO);
    }

    private static Seat seat(UUID hero, @Nullable Selection spell, List<SeatEnchantment> enchantments,
            List<SeatSlot> equipment, BuildStep... build) {
        return seat(hero, spell, enchantments, new SeatInventory(LENGTH, equipment), build);
    }

    private static Seat seat(UUID hero, @Nullable Selection spell, List<SeatEnchantment> enchantments,
            SeatInventory inventory, BuildStep... build) {
        return new Seat(new Selection(hero, "Hero " + hero), Lane.TOP, null, spell, enchantments, inventory,
                List.of(build));
    }

    private static Selection item(String name) {
        return new Selection(null, name);
    }

    private static BuildStep core(String name) {
        return new BuildStep(item(name), List.of(), List.of(), BuildRole.CORE, false, null);
    }

    /** A step as the first lists wrote it: a place instead of a role. */
    private static BuildStep legacy(String name, BuildPlace place) {
        return new BuildStep(item(name), List.of(), null, null, false, null, place);
    }

    private static SeatEnchantment main(String name, int tier) {
        return new SeatEnchantment(new Selection(null, name), true, tier);
    }

    private static SeatEnchantment other(String name, int tier) {
        return new SeatEnchantment(new Selection(null, name), false, tier);
    }

    private static SeatSlot slot(String name) {
        return new SeatSlot(new Selection(null, name), true);
    }

    private static Catalog catalogItem(Known item) {
        return new Catalog(List.of(), List.of(), List.of(), List.of(item));
    }

    private static PublishedLineup game(Catalog catalog, Seat... seats) {
        return game(LENGTH, catalog, seats);
    }

    private static PublishedLineup game(@Nullable Integer length, Catalog catalog, Seat... seats) {
        return new PublishedLineup(UUID.randomUUID(), Instant.EPOCH, UUID.randomUUID(), 1, Side.BLUE, length, null,
                List.of(new LineupSide(Side.BLUE, UUID.randomUUID(), List.of(), List.of(seats))), List.of(), null,
                catalog);
    }
}
