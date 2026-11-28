package com.wikiaov.community.tournament.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.BuildPath.Fate;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildPlace;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildRole;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildStep;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BuildPathTest {
    @Test
    void anItemALaterOneGrewFromWentIntoItAndOneALaterOneReplacesWasSold() {
        var steps = List.of(step("Spear"), step("Boots"), grown("Lance", "Spear"), replacing("Revive", "Boots"),
                step("Orb"));

        assertThat(BuildPath.fates(steps))
                .containsExactly(Fate.UPGRADED, Fate.SOLD, Fate.HELD, Fate.HELD, Fate.HELD);
        assertThat(BuildPath.successor(steps, 0)).isEqualTo(2);
        assertThat(BuildPath.successor(steps, 1)).isEqualTo(3);
        assertThat(BuildPath.successor(steps, 4)).isEqualTo(-1);
    }

    @Test
    void aTierTwoHeldLongBeforeItIsFinishedIsUpgradedWhateverCameBetween() {
        var steps = List.of(step("Spear"), step("Boots"), step("Axe"), step("Shield"), grown("Lance", "Spear"));

        assertThat(BuildPath.fates(steps).getFirst()).isEqualTo(Fate.UPGRADED);
    }

    @Test
    void anItemMarkedSoldThatNoLaterStepNamesIsSold() {
        var steps = List.of(new BuildStep(item("Orb"), List.of(), List.of(), BuildRole.PROTECTIVE, true, null));

        assertThat(BuildPath.fates(steps)).containsExactly(Fate.SOLD);
    }

    @Test
    void onlyAnEarlierStepGoesIntoALaterOne() {
        var steps = List.of(grown("Lance", "Spear"), step("Spear"));

        assertThat(BuildPath.fates(steps)).containsExactly(Fate.HELD, Fate.HELD);
    }

    @Test
    void twoNamesAreTheSameItemInAnyCaseAndAnIdIsComparedAsItIs() {
        var id = UUID.randomUUID();

        assertThat(BuildPath.key(item(" Thương ĐẦU sĩ "))).isEqualTo(BuildPath.key(item("thương đầu sĩ")));
        assertThat(BuildPath.key(new Selection(id, "Blade"))).isEqualTo(BuildPath.key(new Selection(id, "Other")));
    }

    @Test
    void aListOfTheFirstKindIsReadAsItIsWrittenNow() {
        var steps = List.of(legacy("Spear", BuildPlace.REPLACED), legacy("Boots", BuildPlace.REPLACED),
                new BuildStep(item("Lance"), List.of(item("Spear")), null, null, false, null, BuildPlace.KEPT),
                legacy("Revive", BuildPlace.SITUATIONAL));

        var current = BuildPath.current(steps);

        assertThat(current).extracting(BuildStep::role).containsExactly(BuildRole.CORE, BuildRole.CORE,
                BuildRole.CORE, BuildRole.PROTECTIVE);
        assertThat(current).extracting(BuildStep::sold).containsExactly(false, true, false, false);
        assertThat(current).extracting(BuildStep::place).containsOnlyNulls();
        assertThat(BuildPath.fates(current)).containsExactly(Fate.UPGRADED, Fate.SOLD, Fate.HELD, Fate.HELD);
    }

    @Test
    void aListOfTheCurrentKindIsLeftAsItIs() {
        var steps = List.of(step("Spear"), replacing("Revive", "Spear"));

        assertThat(BuildPath.current(steps)).isEqualTo(steps);
    }

    private static Selection item(String name) {
        return new Selection(null, name);
    }

    private static BuildStep step(String name) {
        return new BuildStep(item(name), List.of(), List.of(), BuildRole.CORE, false, null);
    }

    private static BuildStep grown(String name, String part) {
        return new BuildStep(item(name), List.of(item(part)), List.of(), BuildRole.CORE, false, null);
    }

    private static BuildStep replacing(String name, String gone) {
        return new BuildStep(item(name), List.of(), List.of(item(gone)), BuildRole.PROTECTIVE, false, null);
    }

    private static BuildStep legacy(String name, BuildPlace place) {
        return new BuildStep(item(name), List.of(), null, null, false, null, place);
    }
}
