package com.wikiaov.community.tournament.internal.games.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EventType;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Participant;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Reference;
import java.util.HashSet;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What a player carried: inventory snapshots of six slots and the buys, sales, upgrades and swaps between them. */
final class EquipmentRules {
    static final int INVENTORY_SLOTS = 6;
    static final int MAX_EQUIPMENT_SNAPSHOTS = 1000;
    static final int MAX_EQUIPMENT_EVENTS = 2000;

    private EquipmentRules() {
    }

    static void check(Participant participant, String path, boolean publication, @Nullable Integer duration,
            @Nullable Catalog catalog, List<String> errors) {
        if (participant.equipmentSnapshots().size() > MAX_EQUIPMENT_SNAPSHOTS
                || participant.equipmentEvents().size() > MAX_EQUIPMENT_EVENTS) {
            errors.add(path + ".equipment.maximum");
            return;
        }
        var items = catalog == null ? null : catalog.items();
        snapshots(participant, path, publication, duration, items, errors);
        events(participant, path, publication, duration, items, errors);
    }

    private static void snapshots(Participant participant, String path, boolean publication,
            @Nullable Integer duration, @Nullable List<Reference> items, List<String> errors) {
        int previous = -1;
        for (int index = 0; index < participant.equipmentSnapshots().size(); index++) {
            var snapshot = participant.equipmentSnapshots().get(index);
            String field = path + ".equipmentSnapshots[" + index + "]";
            GameSeconds.moment(snapshot.atSeconds(), duration, field, errors);
            if (snapshot.atSeconds() != null) {
                if (snapshot.atSeconds() <= previous) {
                    errors.add(field + ".time.order");
                }
                previous = snapshot.atSeconds();
            }
            if (snapshot.slots().size() > INVENTORY_SLOTS
                    || publication && snapshot.slots().size() != INVENTORY_SLOTS) {
                errors.add(field + ".slots.six");
            }
            var slots = new HashSet<Integer>();
            for (var slot : snapshot.slots()) {
                if (!validSlot(slot.slot()) || !slots.add(slot.slot())) {
                    errors.add(field + ".slot.uniqueOneToSix");
                }
                if (!slot.known() && Selections.present(slot.item())) {
                    errors.add(field + ".slot.unknownHasItem");
                }
                if (Selections.present(slot.item())) {
                    Selections.check(slot.item(), publication, field + ".item", errors, items);
                }
            }
        }
    }

    private static void events(Participant participant, String path, boolean publication, @Nullable Integer duration,
            @Nullable List<Reference> items, List<String> errors) {
        int previous = -1;
        for (int index = 0; index < participant.equipmentEvents().size(); index++) {
            var event = participant.equipmentEvents().get(index);
            String field = path + ".equipmentEvents[" + index + "]";
            GameSeconds.moment(event.atSeconds(), duration, field, errors);
            if (event.atSeconds() != null) {
                if (event.atSeconds() < previous) {
                    errors.add(field + ".time.order");
                }
                previous = event.atSeconds();
            }
            if (event.type() == null) {
                errors.add(field + ".type");
                continue;
            }
            if (event.type() == EventType.SWAP) {
                if (!validSlot(event.fromSlot()) || !validSlot(event.toSlot())
                        || event.fromSlot().equals(event.toSlot())) {
                    errors.add(field + ".swap.slots");
                }
            } else {
                Selections.check(event.item(), true, field + ".item", errors, items);
                if (event.type() == EventType.SELL && !validSlot(event.fromSlot())
                        || event.type() != EventType.SELL && !validSlot(event.toSlot())) {
                    errors.add(field + ".slot");
                }
            }
            if (Selections.present(event.replacedItem())) {
                Selections.check(event.replacedItem(), publication, field + ".replacedItem", errors, items);
            }
        }
    }

    private static boolean validSlot(@Nullable Integer slot) {
        return slot != null && slot >= 1 && slot <= INVENTORY_SLOTS;
    }
}
