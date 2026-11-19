package com.wikiaov.community.tournament.internal.games.domain;

import static com.wikiaov.community.testsupport.GameContentFixtures.reference;
import static com.wikiaov.community.testsupport.GameContentFixtures.selection;
import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EquipmentEvent;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EquipmentSnapshot;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EventType;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.InventorySlot;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Participant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class EquipmentRulesTest {
    private static final Catalog CATALOG = new Catalog(List.of(), List.of(reference(200, 1, null, null)), List.of(),
            List.of(), List.of(), null);

    @Test
    void aPlayerHasAtMostOneThousandInventorySnapshots() {
        var snapshots = IntStream.range(0, 1001).mapToObj(index -> new EquipmentSnapshot(null, null, null)).toList();

        assertThat(violations(snapshots, List.of(), false)).containsExactly("player.equipment.maximum");
    }

    @Test
    void aPublishedSnapshotShowsAllSixSlots() {
        var slots = IntStream.rangeClosed(1, 5).mapToObj(slot -> new InventorySlot(slot, true, null)).toList();

        assertThat(violations(List.of(new EquipmentSnapshot(0, slots, null)), List.of(), true))
                .containsExactly("player.equipmentSnapshots[0].slots.six");
    }

    @Test
    void everyEquipmentEventNamesItsType() {
        var event = new EquipmentEvent(10, null, selection(200), null, null, 1, null);

        assertThat(violations(List.of(), List.of(event), false)).containsExactly("player.equipmentEvents[0].type");
    }

    @Test
    void aPublishedReplacedItemMustBeAvailableInThePatch() {
        var event = new EquipmentEvent(10, EventType.UPGRADE, selection(200), selection(999), null, 1, null);

        assertThat(violations(List.of(), List.of(event), true))
                .containsExactly("player.equipmentEvents[0].replacedItem.unavailableInPatch");
    }

    private static List<String> violations(List<EquipmentSnapshot> snapshots, List<EquipmentEvent> events,
            boolean publication) {
        var participant = new Participant(null, null, null, null, null, null, snapshots, events, null);
        var errors = new ArrayList<String>();
        EquipmentRules.check(participant, "player", publication, 600, CATALOG, errors);
        return errors;
    }
}
