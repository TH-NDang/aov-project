package com.wikiaov.community.tournament.internal.games.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.ArcanaAllocation;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildRole;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildStep;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftKind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftTurn;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EnchantmentAllocation;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EquipmentEvent;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EquipmentSnapshot;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EventType;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.GameDraft;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.GameSide;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.GameTimeline;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.InventorySlot;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Loadout;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.ObjectiveKind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.ObservationStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Participant;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Reference;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Seat;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TimelineEvent;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TimelineKind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.VodPause;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class GameRulesTest {
    private static final UUID SERIES = id(500);
    private static final List<Reference> HEROES = IntStream.rangeClosed(1, 18)
            .mapToObj(index -> reference(index, null, null, null)).toList();
    private static final Catalog CATALOG = new Catalog(HEROES,
            List.of(item(200, 1), item(201, 3, 202), item(202, 2, 200), item(203, 2, 200), item(204, 3, 203),
                    item(205, 2, 203), item(206, null)),
            List.of(reference(100, 3, "RED", null), reference(101, 3, "PURPLE", null),
                    reference(102, 3, "GREEN", null)),
            List.of(reference(110, 1, null, "main"), reference(111, 2, null, "main"),
                    reference(112, 3, null, "main"), reference(113, 1, null, "secondary-a"),
                    reference(114, 1, null, "secondary-b"), reference(115, 2, null, "secondary-a")),
            List.of(reference(300, null, null, null)), null);

    @Test
    void incompleteDraftsRemainSaveableButPublicationReportsRequiredRosterFields() {
        var draft = new Game(null, null, null, null, null, null, null, null, null, null, null, null,
                List.of(), false);

        assertThat(GameRules.violations(draft, false, CATALOG)).isEmpty();
        assertThat(GameRules.violations(draft, true, CATALOG))
                .contains("seriesId", "number", "region", "locale", "sides.two");
    }

    @Test
    void aGameNamesALocaleTheCatalogCanAnswerOrNoneYet() {
        for (String supported : List.of("vi-VN", "en-US")) {
            assertThat(GameRules.violations(withLocale(supported), false, null)).isEmpty();
            assertThat(GameRules.violations(withLocale(supported), true, CATALOG)).isEmpty();
        }

        // A bare language tag is what an import once wrote; the catalog has no answer for it.
        for (String unsupported : List.of("vi", "en", "vi-vn", "th-TH")) {
            assertThat(GameRules.violations(withLocale(unsupported), false, null))
                    .containsExactly("locale.unsupported");
            assertThat(GameRules.violations(withLocale(unsupported), true, CATALOG))
                    .containsExactly("locale.unsupported");
        }

        assertThat(GameRules.violations(withLocale(null), false, null)).isEmpty();
        assertThat(GameRules.violations(withLocale(" "), false, null)).isEmpty();
        assertThat(GameRules.violations(withLocale(" "), true, CATALOG)).containsExactly("locale");
    }

    @Test
    void tenPlayersEightBansAndOneSpellEachCanPublishWithoutUnobservedLoadouts() {
        assertThat(GameRules.violations(game(), true, CATALOG)).isEmpty();

        var participant = participant(game(), 0, 0);
        var notShown = new Participant(participant.playerId(), participant.lane(), participant.hero(),
                participant.spell(), new Loadout<>(ObservationStatus.NOT_SHOWN, List.of(), "Not shown by broadcaster"),
                new Loadout<>(ObservationStatus.NOT_SHOWN, List.of(), null), List.of(), List.of(), null);

        assertThat(GameRules.violations(replaceParticipant(game(), 0, 0, notShown), true, CATALOG)).isEmpty();
    }

    @Test
    void aPlayerSpellOrBanNobodySawDoesNotHoldAGameBack() {
        var original = game();
        var first = participant(original, 0, 0);
        var edited = replaceParticipant(original, 0, 0,
                new Participant(null, first.lane(), first.hero(), null, null, null, List.of(), List.of(), null));
        var blue = edited.sides().getFirst();
        edited = replaceSide(edited, 0, new GameSide(blue.side(), blue.teamId(), blue.bans().subList(0, 3),
                blue.participants()));

        assertThat(GameRules.violations(edited, true, CATALOG)).isEmpty();
    }

    @Test
    void aPublishedGameNamesTheHeroAndTheLaneOfEverySeat() {
        var empty = new Participant(null, null, null, null, null, null, List.of(), List.of(), null);

        assertThat(GameRules.violations(replaceParticipant(game(), 0, 0, empty), true, CATALOG))
                .containsExactly("sides[0].participants[0].lane", "sides[0].participants[0].hero");
    }

    @Test
    void aPublishedGameHasFiveSeatsOnEachSide() {
        for (int index = 0; index < 2; index++) {
            var side = game().sides().get(index);
            var edited = replaceSide(game(), index, new GameSide(side.side(), side.teamId(), side.bans(),
                    side.participants().subList(0, 4)));

            assertThat(GameRules.violations(edited, true, CATALOG))
                    .containsExactly("sides[" + index + "].participants.five");
        }
    }

    @Test
    void aPublishedGameNamesTheColorAndTheTeamOfEachSide() {
        for (int index = 0; index < 2; index++) {
            var side = game().sides().get(index);
            var edited = replaceSide(game(), index, new GameSide(null, null, side.bans(), side.participants()));

            assertThat(GameRules.violations(edited, true, CATALOG))
                    .containsExactly("sides[" + index + "].side", "sides[" + index + "].teamId");
        }
    }

    @Test
    void aDraftIsSavedWithoutTheTeamsSeatsAndSlotsAPublicationNeeds() {
        var first = participant(game(), 0, 0);
        var seen = new Participant(first.playerId(), first.lane(), first.hero(), first.spell(), null, null,
                List.of(new EquipmentSnapshot(20, emptyInventory().subList(0, 5), null)), List.of(), null);
        var draft = replaceSide(game(), 0, new GameSide(null, null, List.of(), List.of(seen)));

        assertThat(GameRules.violations(draft, false, null)).isEmpty();
    }

    @Test
    void aSpellOrBanThatIsNamedMustExistInThePatch() {
        var first = participant(game(), 0, 0);
        var edited = replaceParticipant(game(), 0, 0, new Participant(first.playerId(), first.lane(), first.hero(),
                selection(999), null, null, List.of(), List.of(), null));
        var blue = edited.sides().getFirst();
        edited = replaceSide(edited, 0, new GameSide(blue.side(), blue.teamId(), List.of(selection(998)),
                blue.participants()));

        assertThat(GameRules.violations(edited, true, CATALOG)).containsExactly(
                "sides[0].bans[0].unavailableInPatch", "sides[0].participants[0].spell.unavailableInPatch");
    }

    @Test
    void aBuildListsTheItemsOfHigherTiersWithWhatTheyGrewFromAndWhatTheyReplaced() {
        var build = List.of(new BuildStep(selection(202), List.of(), List.of(), BuildRole.CORE, false, 180),
                new BuildStep(selection(203), List.of(), List.of(), BuildRole.CORE, false, 300),
                new BuildStep(selection(201), List.of(selection(202)), List.of(), BuildRole.CORE, false, 420),
                new BuildStep(new Selection(null, "Observed item"), List.of(), List.of(selection(203)),
                        BuildRole.PROTECTIVE, false, null));

        assertThat(GameRules.violations(withBuild(build), true, CATALOG)).isEmpty();
    }

    @Test
    void aBuildNamesNoItemTwiceHoweverOftenItWasBought() {
        var build = List.of(step(selection(201)), step(selection(201)));

        assertThat(GameRules.violations(withBuild(build), false, null))
                .containsExactly("sides[0].participants[0].build[1].item.duplicate");
    }

    @Test
    void aBuildHasNoMoreThanTwentyFourSteps() {
        var build = new ArrayList<>(steps(6));
        build.addAll(steps(18).stream().map(step -> new BuildStep(new Selection(null, step.item().name() + " sold"),
                List.of(), List.of(), BuildRole.PROTECTIVE, true, null)).toList());
        assertThat(GameRules.violations(withBuild(build), false, null)).isEmpty();

        build.add(step(new Selection(null, "One more")));
        assertThat(GameRules.violations(withBuild(build), false, null))
                .containsExactly("sides[0].participants[0].build.maximum");
    }

    @Test
    void aBuildHoldsNoMoreItemsToTheEndThanAnInventoryHasSlots() {
        assertThat(GameRules.violations(withBuild(steps(7)), false, null))
                .containsExactly("sides[0].participants[0].build.held.maximum");
    }

    @Test
    void itemsThatWentIntoOthersOrWereSoldDoNotCountTowardsTheSixHeldToTheEnd() {
        var build = new ArrayList<BuildStep>();
        build.add(step(new Selection(null, "Part")));
        build.add(new BuildStep(new Selection(null, "Boots"), List.of(), List.of(), BuildRole.CORE, false, null));
        build.addAll(steps(4));
        build.add(new BuildStep(new Selection(null, "Grown"), List.of(new Selection(null, "part")), List.of(),
                BuildRole.CORE, false, null));
        build.add(new BuildStep(new Selection(null, "Revive"), List.of(), List.of(new Selection(null, "Boots")),
                BuildRole.PROTECTIVE, false, null));
        build.add(new BuildStep(new Selection(null, "For a moment"), List.of(), List.of(), BuildRole.PROTECTIVE,
                true, null));

        assertThat(GameRules.violations(withBuild(build), false, null)).isEmpty();
    }

    @Test
    void aStepReplacesOnlyItemsBoughtBeforeItAndStillHeld() {
        var build = List.of(step(selection(202)),
                new BuildStep(selection(201), List.of(selection(202)), List.of(), BuildRole.CORE, false, null),
                new BuildStep(selection(204), List.of(), List.of(selection(202), selection(203)), BuildRole.CORE,
                        false, null),
                new BuildStep(selection(205), List.of(), List.of(selection(205)), BuildRole.CORE, false, null),
                new BuildStep(selection(203), List.of(), List.of(selection(201), selection(201)), BuildRole.CORE,
                        false, null));

        assertThat(GameRules.violations(withBuild(build), false, null)).containsExactly(
                "sides[0].participants[0].build[2].replaces[0].gone",
                "sides[0].participants[0].build[2].replaces[1].notBuilt",
                "sides[0].participants[0].build[3].replaces[0].same",
                "sides[0].participants[0].build[4].replaces[1].duplicate");
    }

    @Test
    void aStepReplacesNoMoreThanTwoItemsAndNamesEachOfThem() {
        var three = List.of(step(selection(201)), step(selection(202)), step(selection(203)),
                new BuildStep(selection(204), List.of(), List.of(selection(201), selection(202), selection(203)),
                        BuildRole.CORE, false, null));
        var blank = List.of(new BuildStep(selection(204), List.of(), List.of(new Selection(null, " ")),
                BuildRole.CORE, false, null));

        assertThat(GameRules.violations(withBuild(three), false, null))
                .containsExactly("sides[0].participants[0].build[3].replaces.maximum");
        assertThat(GameRules.violations(withBuild(blank), false, null))
                .containsExactly("sides[0].participants[0].build[0].replaces[0]");
    }

    @Test
    void theStepsOfABuildFollowTheOrderTheyWereBoughtIn() {
        var build = List.of(new BuildStep(selection(202), List.of(), List.of(), BuildRole.CORE, false, 300),
                new BuildStep(selection(203), List.of(), List.of(), BuildRole.CORE, false, null),
                new BuildStep(selection(201), List.of(), List.of(), BuildRole.CORE, false, 240));

        assertThat(GameRules.violations(withBuild(build), false, null))
                .containsExactly("sides[0].participants[0].build[2].time.order");
    }

    @Test
    void aBuildLeavesOutTheItemsOfTheLowestTier() {
        var build = List.of(
                new BuildStep(selection(201), List.of(selection(200)), List.of(), BuildRole.CORE, false, null),
                step(selection(200)));

        assertThat(GameRules.violations(withBuild(build), true, CATALOG)).containsExactly(
                "sides[0].participants[0].build[0].from[0].tier", "sides[0].participants[0].build[1].item.tier");
    }

    @Test
    void anItemOfABuildDoesNotGrowFromItselfNorTwiceFromAnother() {
        var build = List.of(grown(selection(201), selection(201), selection(202), selection(202)));
        var refused = List.of("sides[0].participants[0].build[0].from[0].same",
                "sides[0].participants[0].build[0].from[2].duplicate");

        assertThat(GameRules.violations(withBuild(build), false, null)).isEqualTo(refused);
        assertThat(GameRules.violations(withBuild(build), true, CATALOG)).isEqualTo(refused);
    }

    @Test
    void anItemOfABuildIsMadeOfNoMoreThanThreeOthers() {
        var parts = IntStream.rangeClosed(1, 4).mapToObj(index -> new Selection(null, "Part " + index)).toList();
        var three = List.of(grown(selection(201), parts.subList(0, 3).toArray(Selection[]::new)));
        var four = List.of(grown(selection(201), parts.toArray(Selection[]::new)));

        assertThat(GameRules.violations(withBuild(three), false, null)).isEmpty();
        assertThat(GameRules.violations(withBuild(four), false, null))
                .containsExactly("sides[0].participants[0].build[0].from.maximum");
    }

    @Test
    void anItemOfABuildDoesNotGrowFromOneOfAHigherTier() {
        var build = List.of(grown(selection(202), selection(201)));

        assertThat(GameRules.violations(withBuild(build), true, CATALOG))
                .containsExactly("sides[0].participants[0].build[0].from[0].notLower");
    }

    @Test
    void twoFinishedItemsOfABuildDoNotGrowFromEachOther() {
        var build = List.of(grown(selection(201), selection(204)), grown(selection(204), selection(201)));

        assertThat(GameRules.violations(withBuild(build), true, CATALOG)).containsExactly(
                "sides[0].participants[0].build[0].from[0].notLower",
                "sides[0].participants[0].build[1].from[0].notLower");
    }

    @Test
    void anItemOfABuildMayGrowFromOneOfItsOwnTierThatItsRecipeNames() {
        var build = List.of(grown(selection(205), selection(203)));

        assertThat(GameRules.violations(withBuild(build), true, CATALOG)).isEmpty();
    }

    @Test
    void aPartIsComparedWithItsItemOnlyWhenTheTiersOfBothAreKnown() {
        var named = new Selection(null, "Observed part");
        var build = List.of(grown(selection(202), named, selection(206)), grown(selection(206), selection(204)),
                grown(new Selection(null, "Observed item"), selection(204)));

        assertThat(GameRules.violations(withBuild(build), true, CATALOG)).isEmpty();
    }

    @Test
    void anItemIsBuiltInsideTheGame() {
        var build = List.of(new BuildStep(selection(201), List.of(), List.of(), BuildRole.CORE, false, 601));

        assertThat(GameRules.violations(withBuild(build), false, null))
                .containsExactly("sides[0].participants[0].build[0].atSeconds.range");
    }

    @Test
    void aBuildThatNamesNoItemIsRefused() {
        assertThat(GameRules.violations(withBuild(List.of(step(null))), false, null))
                .containsExactly("sides[0].participants[0].build[0].item");
    }

    @Test
    void anItemOfABuildMustExistInThePatch() {
        var build = List.of(grown(selection(999), selection(998)));

        assertThat(GameRules.violations(withBuild(build), true, CATALOG)).containsExactly(
                "sides[0].participants[0].build[0].item.unavailableInPatch",
                "sides[0].participants[0].build[0].from[0].unavailableInPatch");
    }

    @Test
    void aHeroCannotBePickedTwiceOrPickedAfterBeingBanned() {
        var original = game();
        var player = participant(original, 1, 0);
        var duplicate = new Participant(player.playerId(), player.lane(), selection(1), player.spell(), null,
                null, List.of(), List.of(), null);
        assertThat(GameRules.violations(replaceParticipant(original, 1, 0, duplicate), true, CATALOG))
                .contains("sides[1].participants[0].hero.duplicate");

        var banned = new Participant(player.playerId(), player.lane(), selection(11), player.spell(), null,
                null, List.of(), List.of(), null);
        assertThat(GameRules.violations(replaceParticipant(original, 1, 0, banned), true, CATALOG))
                .contains("sides.hero.alreadyBanned");
    }

    @Test
    void duplicatePlayersTeamsLanesAndBansCannotBePublished() {
        var original = game();
        var first = participant(original, 0, 0);
        var second = participant(original, 0, 1);
        var duplicate = new Participant(first.playerId(), first.lane(), second.hero(), second.spell(), null,
                null, List.of(), List.of(), null);
        var edited = replaceParticipant(original, 0, 1, duplicate);
        var red = edited.sides().get(1);
        var bans = new ArrayList<>(red.bans());
        bans.set(0, edited.sides().getFirst().bans().getFirst());
        edited = replaceSide(edited, 1, new GameSide(red.side(), edited.sides().getFirst().teamId(), bans,
                red.participants()));

        assertThat(GameRules.violations(edited, true, CATALOG)).contains(
                "sides[0].participants[1].playerId.duplicate", "sides[0].participants[1].lane.duplicate",
                "sides[1].teamId.duplicate", "sides[1].bans[0].duplicate");
    }

    @Test
    void referencesOutsideTheSelectedPatchAreRejectedInsteadOfSilentlyUsingCurrentData() {
        var original = game();
        var first = participant(original, 0, 0);
        var unavailable = new Participant(first.playerId(), first.lane(), selection(999), first.spell(), null,
                null, List.of(), List.of(), null);

        assertThat(GameRules.violations(replaceParticipant(original, 0, 0, unavailable), true, CATALOG))
                .contains("sides[0].participants[0].hero.unavailableInPatch");
    }

    @Test
    void knownArcanaRequiresThirtyWithTenPerColorAndChecksCatalogColor() {
        var allocations = List.of(new ArcanaAllocation(selection(100), 10, "RED"),
                new ArcanaAllocation(selection(101), 10, "PURPLE"),
                new ArcanaAllocation(selection(102), 10, "GREEN"));
        assertThat(GameRules.violations(withLoadouts(new Loadout<>(ObservationStatus.KNOWN, allocations, null),
                null), true, CATALOG)).isEmpty();

        var incomplete = List.of(new ArcanaAllocation(selection(100), 9, "RED"),
                new ArcanaAllocation(selection(101), 10, "PURPLE"),
                new ArcanaAllocation(selection(102), 10, "GREEN"));
        assertThat(GameRules.violations(withLoadouts(new Loadout<>(ObservationStatus.KNOWN, incomplete, null),
                null), true, CATALOG)).contains("sides[0].participants[0].arcana.total.thirty",
                        "sides[0].participants[0].arcana.colors.RED.ten");

        var mismatch = List.of(new ArcanaAllocation(selection(100), 10, "GREEN"),
                new ArcanaAllocation(selection(101), 10, "PURPLE"),
                new ArcanaAllocation(selection(102), 10, "GREEN"));
        assertThat(GameRules.violations(withLoadouts(new Loadout<>(ObservationStatus.KNOWN, mismatch, null),
                null), true, CATALOG)).contains("sides[0].participants[0].arcana.entries[0].color.mismatch");
    }

    @Test
    void anUnobservedLoadoutCannotCarryEntriesAndPretendTheyAreAbsent() {
        var unknown = new Loadout<>(ObservationStatus.UNKNOWN,
                List.of(new ArcanaAllocation(selection(100), 10, "RED")), null);
        assertThat(GameRules.violations(withLoadouts(unknown, null), false, CATALOG))
                .contains("sides[0].participants[0].arcana.unknownHasEntries");
    }

    @Test
    void enchantmentsRespectThePrimaryBranchAndBothSecondaryLayouts() {
        var mixed = enchantments();
        assertThat(GameRules.violations(withLoadouts(null, new Loadout<>(ObservationStatus.KNOWN, mixed, null)),
                true, CATALOG)).isEmpty();

        var sameSecondary = new ArrayList<>(mixed);
        sameSecondary.set(4, new EnchantmentAllocation(selection(115), false, 2, "secondary-a"));
        assertThat(GameRules.violations(withLoadouts(null,
                new Loadout<>(ObservationStatus.KNOWN, sameSecondary, null)), true, CATALOG)).isEmpty();

        var wrongTier = new ArrayList<>(mixed);
        wrongTier.set(4, new EnchantmentAllocation(selection(112), false, 3, "main"));
        assertThat(GameRules.violations(withLoadouts(null,
                new Loadout<>(ObservationStatus.KNOWN, wrongTier, null)), true, CATALOG))
                .contains("sides[0].participants[0].enchantments.entries[4].tier.range",
                        "sides[0].participants[0].enchantments.secondary.differentBranch");
    }

    @Test
    void sixExplicitInventorySlotsPreserveLowTierItemsEmptySlotsAndUnknownObservations() {
        var slots = emptyInventory();
        slots.set(0, new InventorySlot(1, true, selection(200)));
        slots.set(5, new InventorySlot(6, false, null));
        var snapshots = List.of(new EquipmentSnapshot(0, slots, null),
                new EquipmentSnapshot(120, emptyInventory(), "Items no longer visible"));
        var events = List.of(new EquipmentEvent(0, EventType.BUY, selection(200), null, null, 1, null),
                new EquipmentEvent(90, EventType.SELL, selection(200), null, 1, null, null),
                new EquipmentEvent(120, EventType.BUY, selection(201), null, null, 3, null),
                new EquipmentEvent(125, EventType.SWAP, null, null, 3, 5, null));

        assertThat(GameRules.violations(withInventory(snapshots, events), true, CATALOG)).isEmpty();
    }

    @Test
    void anInventoryThatShowsFewerThanSixSlotsIsNotPublished() {
        var snapshot = new EquipmentSnapshot(20, emptyInventory().subList(0, 5), null);

        assertThat(GameRules.violations(withInventory(List.of(snapshot), List.of()), true, CATALOG))
                .containsExactly("sides[0].participants[0].equipmentSnapshots[0].slots.six");
    }

    @Test
    void inventoryRejectsDuplicateSlotsUnknownItemsAndObservationsAfterGameEnd() {
        var slots = emptyInventory();
        slots.set(0, new InventorySlot(1, false, selection(200)));
        slots.set(1, new InventorySlot(1, true, null));
        assertThat(GameRules.violations(withInventory(List.of(new EquipmentSnapshot(601, slots, null)), List.of()),
                true, CATALOG)).contains("sides[0].participants[0].equipmentSnapshots[0].atSeconds.range",
                        "sides[0].participants[0].equipmentSnapshots[0].slot.uniqueOneToSix",
                        "sides[0].participants[0].equipmentSnapshots[0].slot.unknownHasItem");

        assertThat(GameRules.violations(withInventory(List.of(
                new EquipmentSnapshot(20, emptyInventory(), null),
                new EquipmentSnapshot(10, emptyInventory(), null)), List.of()), true, CATALOG))
                .contains("sides[0].participants[0].equipmentSnapshots[1].time.order");
    }

    @Test
    void inventoryEventsValidateSourceDestinationTimeAndKnownItemReferences() {
        var events = List.of(new EquipmentEvent(10, EventType.SWAP, null, null, 2, 2, null),
                new EquipmentEvent(5, EventType.SELL, selection(200), null, null, null, null),
                new EquipmentEvent(601, EventType.BUY, selection(999), null, null, 7, null));

        assertThat(GameRules.violations(withInventory(List.of(), events), true, CATALOG)).contains(
                "sides[0].participants[0].equipmentEvents[0].swap.slots",
                "sides[0].participants[0].equipmentEvents[1].time.order",
                "sides[0].participants[0].equipmentEvents[1].slot",
                "sides[0].participants[0].equipmentEvents[2].atSeconds.range",
                "sides[0].participants[0].equipmentEvents[2].item.unavailableInPatch",
                "sides[0].participants[0].equipmentEvents[2].slot");
    }

    @Test
    void timelineAcceptsKillsObjectivesNotesAndPausesWithoutBlockingPublication() {
        var timeline = new GameTimeline(List.of(new VodPause(120, 95)),
                List.of(kill("k1", 60, seat(Side.BLUE, Lane.JUNGLE), seat(Side.RED, Lane.MID),
                        List.of(seat(Side.BLUE, Lane.MID))),
                        kill("k2", 90, null, seat(Side.BLUE, Lane.DRAGON), List.of(seat(Side.RED, Lane.SUPPORT))),
                        new TimelineEvent("o1", 240, TimelineKind.OBJECTIVE, null, null, null, Side.RED,
                                ObjectiveKind.DARK_SLAYER, seat(Side.RED, Lane.JUNGLE), null, null),
                        new TimelineEvent("n1", 240, TimelineKind.NOTE, null, null, null, null, null, null,
                                "Teamfight at the dragon pit", null)));

        assertThat(GameRules.violations(withTimeline(game(), timeline), true, CATALOG)).isEmpty();
        assertThat(GameRules.violations(withTimeline(game(), GameTimeline.EMPTY), true, CATALOG)).isEmpty();
    }

    @Test
    void timelineRejectsImpossibleKillsAndEventsOutsideTheGameClock() {
        var timeline = new GameTimeline(List.of(new VodPause(300, 0), new VodPause(200, 30)), List.of(
                kill("same", 10, seat(Side.BLUE, Lane.TOP), seat(Side.BLUE, Lane.MID), List.of()),
                kill("assist", 20, seat(Side.BLUE, Lane.TOP), seat(Side.RED, Lane.MID),
                        List.of(seat(Side.RED, Lane.TOP), seat(Side.BLUE, Lane.TOP))),
                kill("nobody", 30, null, null, List.of()),
                kill("late", 700, seat(Side.BLUE, Lane.TOP), seat(Side.RED, Lane.MID), List.of()),
                kill("late", 5, seat(Side.BLUE, Lane.TOP), seat(Side.RED, Lane.MID), List.of()),
                new TimelineEvent("bad id!", 600, TimelineKind.OBJECTIVE, null, null, null, null, null,
                        seat(Side.RED, Lane.JUNGLE), "title", null),
                new TimelineEvent("note", 600, TimelineKind.NOTE, null, null, null, Side.BLUE, null, null, " ", null),
                new TimelineEvent("kind", 600, null, null, null, null, null, null, null, null, null)));

        assertThat(GameRules.violations(withTimeline(game(), timeline), false, CATALOG)).contains(
                "timeline.pauses[0].durationSeconds.range", "timeline.pauses[1].time.order",
                "timeline.events[0].victim.sameSide", "timeline.events[1].assists[0].side",
                "timeline.events[1].assists[1].duplicate", "timeline.events[2].kill.participant",
                "timeline.events[3].atSeconds.range", "timeline.events[4].id.duplicate",
                "timeline.events[4].time.order", "timeline.events[5].id", "timeline.events[5].fields.unexpected",
                "timeline.events[5].side", "timeline.events[5].objective", "timeline.events[6].title",
                "timeline.events[7].kind");
    }

    @Test
    void objectiveFinisherMustBelongToTheTeamThatTookIt() {
        var timeline = new GameTimeline(List.of(), List.of(new TimelineEvent("o1", 100, TimelineKind.OBJECTIVE, null,
                null, null, Side.BLUE, ObjectiveKind.ABYSSAL_DRAGON, seat(Side.RED, Lane.JUNGLE), null, null)));

        assertThat(GameRules.violations(withTimeline(game(), timeline), false, CATALOG))
                .containsExactly("timeline.events[0].by.side");
    }

    @Test
    void partialLoadoutsKeepWhatTheSourceShowedAndCanStillBePublished() {
        // The broadcast showed only the red arcana as stats and two enchantments; exact names are unknown.
        var arcana = new Loadout<>(ObservationStatus.PARTIAL,
                List.of(new ArcanaAllocation(new Selection(null, null), 10, "RED")), "Tốc đánh, tỉ lệ chí mạng", 27);
        var enchantments = new Loadout<>(ObservationStatus.PARTIAL,
                List.of(new EnchantmentAllocation(selection(110), true, 1, "main"),
                        new EnchantmentAllocation(new Selection(null, "Observed"), false, 1, null)),
                null, 45);
        var first = participant(game(), 0, 0);
        var partial = replaceParticipant(game(), 0, 0, new Participant(first.playerId(), first.lane(), first.hero(),
                first.spell(), arcana, enchantments, List.of(), List.of(), null, 45));

        assertThat(GameRules.violations(partial, true, CATALOG)).isEmpty();

        var unnamed = new Loadout<>(ObservationStatus.PARTIAL,
                List.of(new ArcanaAllocation(new Selection(null, null), 4, null)), null, 900);
        var late = replaceParticipant(game(), 0, 0, new Participant(first.playerId(), first.lane(), first.hero(),
                first.spell(), unnamed, null, List.of(), List.of(), null, 700));
        assertThat(GameRules.violations(late, false, CATALOG)).containsExactlyInAnyOrder(
                "sides[0].participants[0].arcana.entries[0].color",
                "sides[0].participants[0].spellObservedAtSeconds.range",
                "sides[0].participants[0].arcana.observedAtSeconds.range");
    }

    @Test
    void aPartialLoadoutThatNamesSomethingOutsideThePatchIsNotPublished() {
        var arcana = new Loadout<>(ObservationStatus.PARTIAL,
                List.of(new ArcanaAllocation(selection(997), 10, "RED")), null);
        var enchantments = new Loadout<>(ObservationStatus.PARTIAL,
                List.of(new EnchantmentAllocation(selection(998), true, 1, "main")), null);

        assertThat(GameRules.violations(withLoadouts(arcana, enchantments), true, CATALOG)).containsExactly(
                "sides[0].participants[0].arcana.entries[0].selection.unavailableInPatch",
                "sides[0].participants[0].enchantments.entries[0].selection.unavailableInPatch");
    }

    @Test
    void draftTurnsMustProduceTheFinalBansAndLineUpsInsideTheDraftWindow() {
        var drafted = drafted();
        assertThat(GameRules.violations(drafted, true, CATALOG)).isEmpty();

        // Teammates may swap heroes before the lock, but a line-up cannot hold a hero the team never picked.
        var first = participant(drafted, 0, 0);
        var undrafted = replaceParticipant(drafted, 0, 0, new Participant(first.playerId(), first.lane(),
                new Selection(null, "Observed elsewhere"), first.spell(), null, null, List.of(), List.of(), null));
        assertThat(GameRules.violations(undrafted, false, CATALOG))
                .containsExactly("sides[0].participants[0].hero.notDrafted");
    }

    @Test
    void aPublishedGameListsEveryBannedHeroOfItsDraftAmongTheBansOfTheSide() {
        // The statistics count the bans of the sides: one that only a turn names would be missing from them.
        assertThat(GameRules.violations(withABanOnlyItsDraftNames(), true, CATALOG))
                .containsExactly("draft.turns[6].hero.notBanned");
    }

    @Test
    void aGameWithABanOnlyItsDraftNamesCanStillBeSaved() {
        assertThat(GameRules.violations(withABanOnlyItsDraftNames(), false, null)).isEmpty();
    }

    @Test
    void aBanTurnThatWasNotUsedAsksForNoBanOfItsSide() {
        var drafted = withABanOnlyItsDraftNames();
        var turns = new ArrayList<>(drafted.draft().turns());
        turns.set(6, new DraftTurn(7, DraftKind.BAN, Side.BLUE, null, null));

        assertThat(GameRules.violations(withDraft(drafted, 300, new GameDraft(100, 250, turns)), true, CATALOG))
                .isEmpty();
    }

    @Test
    void draftMarksOutsideTheWindowOrOutOfSequenceAreRejected() {
        var turns = List.of(new DraftTurn(1, DraftKind.BAN, Side.BLUE, selection(11), 90),
                new DraftTurn(3, DraftKind.PICK, Side.RED, null, 120),
                new DraftTurn(3, DraftKind.PICK, Side.RED, selection(11), 110));

        assertThat(GameRules.violations(withDraft(game(), 300, new GameDraft(100, 320, turns)), false, CATALOG))
                .contains("draft.lockedSecond.afterGameStart", "draft.turns[0].atSecond.range", "draft.turns[1].order",
                        "draft.turns[1].hero", "draft.turns[2].hero.duplicate", "sides[0].bans[1].notDrafted");
        assertThat(GameRules.violations(withDraft(game(), null, new GameDraft(null, 50, List.of())), false, CATALOG))
                .containsExactly("draft.lockedSecond.range");
    }

    /** A game with its draft: the bans of both sides in turn from the blue one, then their picks the same way. */
    private static Game drafted() {
        var turns = new ArrayList<DraftTurn>();
        for (int ban = 0; ban < 4; ban++) {
            turns.add(new DraftTurn(turns.size() + 1, DraftKind.BAN, Side.BLUE, selection(11 + ban), 110 + ban * 2));
            turns.add(new DraftTurn(turns.size() + 1, DraftKind.BAN, Side.RED, selection(15 + ban), 111 + ban * 2));
        }
        for (int pick = 0; pick < 5; pick++) {
            turns.add(new DraftTurn(turns.size() + 1, DraftKind.PICK, Side.BLUE, selection(1 + pick), 120 + pick * 2));
            turns.add(new DraftTurn(turns.size() + 1, DraftKind.PICK, Side.RED, selection(6 + pick), 121 + pick * 2));
        }
        return withDraft(game(), 300, new GameDraft(100, 250, turns));
    }

    /** A drafted game whose blue side lists three of the four heroes it banned. */
    private static Game withABanOnlyItsDraftNames() {
        var drafted = drafted();
        var blue = drafted.sides().getFirst();
        return replaceSide(drafted, 0,
                new GameSide(blue.side(), blue.teamId(), blue.bans().subList(0, 3), blue.participants()));
    }

    private static Game withDraft(Game game, Integer liveSecond, GameDraft draft) {
        return new Game(game.seriesId(), game.number(), game.region(), game.locale(), game.seasonId(),
                game.patchVariantId(), game.startedAt(), game.durationSeconds(), game.winner(), game.sourceUrl(),
                liveSecond, game.note(), game.sides(), game.includeUnscoped(), game.timeline(), draft);
    }

    private static TimelineEvent kill(String id, int at, Seat killer, Seat victim, List<Seat> assists) {
        return new TimelineEvent(id, at, TimelineKind.KILL, killer, victim, assists, null, null, null, null, null);
    }

    private static Seat seat(Side side, Lane lane) {
        return new Seat(side, lane);
    }

    private static Game withTimeline(Game game, GameTimeline timeline) {
        return new Game(game.seriesId(), game.number(), game.region(), game.locale(), game.seasonId(),
                game.patchVariantId(), game.startedAt(), game.durationSeconds(), game.winner(), game.sourceUrl(),
                game.sourceTimestampSeconds(), game.note(), game.sides(), game.includeUnscoped(), timeline);
    }

    private static Game withInventory(List<EquipmentSnapshot> snapshots, List<EquipmentEvent> events) {
        var original = game();
        var first = participant(original, 0, 0);
        return replaceParticipant(original, 0, 0, new Participant(first.playerId(), first.lane(), first.hero(),
                first.spell(), null, null, snapshots, events, null));
    }

    private static Game withBuild(List<BuildStep> build) {
        var original = game();
        var first = participant(original, 0, 0);
        return replaceParticipant(original, 0, 0, new Participant(first.playerId(), first.lane(), first.hero(),
                first.spell(), null, null, List.of(), List.of(), null, null, build));
    }

    private static BuildStep step(Selection item) {
        return new BuildStep(item, List.of(), List.of(), BuildRole.CORE, false, null);
    }

    private static BuildStep grown(Selection item, Selection... parts) {
        return new BuildStep(item, List.of(parts), List.of(), BuildRole.CORE, false, null);
    }

    /** As many different items held to the end, known by their names alone. */
    private static List<BuildStep> steps(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(index -> step(new Selection(null, "Item " + index))).toList();
    }

    private static Game withLoadouts(Loadout<ArcanaAllocation> arcana, Loadout<EnchantmentAllocation> enchantments) {
        var original = game();
        var first = participant(original, 0, 0);
        return replaceParticipant(original, 0, 0, new Participant(first.playerId(), first.lane(), first.hero(),
                first.spell(), arcana, enchantments, List.of(), List.of(), null));
    }

    private static List<InventorySlot> emptyInventory() {
        var slots = new ArrayList<InventorySlot>();
        for (int slot = 1; slot <= 6; slot++) {
            slots.add(new InventorySlot(slot, true, null));
        }
        return slots;
    }

    private static List<EnchantmentAllocation> enchantments() {
        return List.of(new EnchantmentAllocation(selection(110), true, 1, "main"),
                new EnchantmentAllocation(selection(111), true, 2, "main"),
                new EnchantmentAllocation(selection(112), true, 3, "main"),
                new EnchantmentAllocation(selection(113), false, 1, "secondary-a"),
                new EnchantmentAllocation(selection(114), false, 1, "secondary-b"));
    }

    private static Game game() {
        var sides = new ArrayList<GameSide>();
        for (int side = 0; side < 2; side++) {
            var participants = new ArrayList<Participant>();
            for (int lane = 0; lane < 5; lane++) {
                participants.add(new Participant(id(1000 + side * 5 + lane),
                        Lane.values()[lane], selection(1 + side * 5 + lane), selection(300), null, null,
                        List.of(), List.of(), null));
            }
            var bans = new ArrayList<Selection>();
            for (int ban = 0; ban < 4; ban++) {
                bans.add(selection(11 + side * 4 + ban));
            }
            sides.add(new GameSide(Side.values()[side], id(600 + side), bans, participants));
        }
        return new Game(SERIES, 1, "VN", "vi-VN", null, null, null, 600, Side.BLUE, null, null, null, sides,
                false);
    }

    private static Game withLocale(String locale) {
        var game = game();
        return new Game(game.seriesId(), game.number(), game.region(), locale, game.seasonId(),
                game.patchVariantId(), game.startedAt(), game.durationSeconds(), game.winner(), game.sourceUrl(),
                game.sourceTimestampSeconds(), game.note(), game.sides(), game.includeUnscoped());
    }

    private static Participant participant(Game game, int side, int index) {
        return game.sides().get(side).participants().get(index);
    }

    private static Game replaceParticipant(Game game, int sideIndex, int index, Participant replacement) {
        var side = game.sides().get(sideIndex);
        var participants = new ArrayList<>(side.participants());
        participants.set(index, replacement);
        return replaceSide(game, sideIndex, new GameSide(side.side(), side.teamId(), side.bans(), participants));
    }

    private static Game replaceSide(Game game, int sideIndex, GameSide replacement) {
        var sides = new ArrayList<>(game.sides());
        sides.set(sideIndex, replacement);
        return new Game(game.seriesId(), game.number(), game.region(), game.locale(), game.seasonId(),
                game.patchVariantId(), game.startedAt(), game.durationSeconds(), game.winner(), game.sourceUrl(),
                game.sourceTimestampSeconds(), game.note(), sides, game.includeUnscoped(), game.timeline(),
                game.draft());
    }

    private static Selection selection(int value) {
        return new Selection(id(value), "entry-" + value);
    }

    private static Reference reference(int value, Integer tier, String color, String branch) {
        return new Reference(id(value), "entry-" + value, "Entry " + value, null, tier, color, branch,
                id(value + 2000));
    }

    /** An item and the items its recipe names. */
    private static Reference item(int value, Integer tier, int... recipe) {
        return new Reference(id(value), "entry-" + value, "Entry " + value, null, tier, null, null, id(value + 2000),
                IntStream.of(recipe).mapToObj(GameRulesTest::id).toList());
    }

    private static UUID id(int value) {
        return new UUID(0, value);
    }
}
