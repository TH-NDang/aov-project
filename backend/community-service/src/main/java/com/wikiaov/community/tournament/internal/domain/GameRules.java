package com.wikiaov.community.tournament.internal.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.text.Normalizer;
import java.util.*;

public final class GameRules {
    private GameRules() {
    }

    public static List<String> violations(Game game, boolean publication, Catalog catalog) {
        var errors = new ArrayList<String>();
        if (game == null)
            return List.of("content");
        if (!SourceUrls.valid(game.sourceUrl()))
            errors.add("sourceUrl.invalid");
        if (game.number() != null && (game.number() < 1 || game.number() > 99))
            errors.add("number.range");
        if (game.durationSeconds() != null && game.durationSeconds() < 0)
            errors.add("durationSeconds.range");
        if (game.sides().size() > 2)
            errors.add("sides.maximum");
        if (publication) {
            require(game.seriesId() != null, "seriesId", errors);
            require(game.number() != null, "number", errors);
            require(game.region() != null && !game.region().isBlank(), "region", errors);
            require(game.locale() != null && !game.locale().isBlank(), "locale", errors);
            require(game.sides().size() == 2, "sides.two", errors);
        }

        var sides = new HashSet<Side>();
        var teams = new HashSet<UUID>();
        var players = new HashSet<UUID>();
        var bans = new HashSet<String>();
        var heroes = new HashSet<String>();
        for (int sideIndex = 0; sideIndex < game.sides().size(); sideIndex++) {
            var side = game.sides().get(sideIndex);
            String path = "sides[" + sideIndex + "]";
            if (side.side() != null && !sides.add(side.side()))
                errors.add(path + ".side.duplicate");
            if (side.teamId() != null && !teams.add(side.teamId()))
                errors.add(path + ".teamId.duplicate");
            if (side.bans().size() > 4)
                errors.add(path + ".bans.maximum");
            if (side.participants().size() > 5)
                errors.add(path + ".participants.maximum");
            if (publication) {
                require(side.side() != null, path + ".side", errors);
                require(side.teamId() != null, path + ".teamId", errors);
                require(side.bans().size() == 4, path + ".bans.four", errors);
                require(side.participants().size() == 5, path + ".participants.five", errors);
            }
            for (int banIndex = 0; banIndex < side.bans().size(); banIndex++) {
                var ban = side.bans().get(banIndex);
                String field = path + ".bans[" + banIndex + "]";
                selection(ban, publication, field, errors, catalog == null ? null : catalog.heroes());
                if (present(ban) && !bans.add(identity(ban)))
                    errors.add(field + ".duplicate");
            }
            var lanes = new HashSet<Lane>();
            for (int index = 0; index < side.participants().size(); index++) {
                var participant = side.participants().get(index);
                String field = path + ".participants[" + index + "]";
                if (participant.playerId() != null && !players.add(participant.playerId()))
                    errors.add(field + ".playerId.duplicate");
                if (participant.lane() != null && !lanes.add(participant.lane()))
                    errors.add(field + ".lane.duplicate");
                if (publication) {
                    require(participant.playerId() != null, field + ".playerId", errors);
                    require(participant.lane() != null, field + ".lane", errors);
                }
                selection(participant.hero(), publication, field + ".hero", errors,
                        catalog == null ? null : catalog.heroes());
                selection(participant.spell(), publication, field + ".spell", errors,
                        catalog == null ? null : catalog.spells());
                if (present(participant.hero()) && !heroes.add(identity(participant.hero())))
                    errors.add(field + ".hero.duplicate");
                arcana(participant.arcana(), field + ".arcana", publication, catalog, errors);
                enchantments(participant.enchantments(), field + ".enchantments", publication, catalog, errors);
                observed(participant.spellObservedAtSeconds(), game.durationSeconds(),
                        field + ".spellObservedAtSeconds", errors);
                observed(participant.arcana().observedAtSeconds(), game.durationSeconds(),
                        field + ".arcana.observedAtSeconds", errors);
                observed(participant.enchantments().observedAtSeconds(), game.durationSeconds(),
                        field + ".enchantments.observedAtSeconds", errors);
                equipment(participant, field, publication, game.durationSeconds(), catalog, errors);
            }
        }
        for (var hero : heroes)
            if (bans.contains(hero))
                errors.add("sides.hero.alreadyBanned");
        timeline(game.timeline(), game.durationSeconds(), errors);
        draft(game, errors);
        return List.copyOf(errors);
    }

    /** Longest video position accepted for draft marks, matching a two-day live stream. */
    private static final int MAX_VIDEO_SECOND = 172_800;

    private static void draft(Game game, List<String> errors) {
        var draft = game.draft();
        if (draft.turns().size() > 40) {
            errors.add("draft.maximum");
            return;
        }
        Integer start = draft.startSecond();
        Integer locked = draft.lockedSecond();
        Integer live = game.sourceTimestampSeconds();
        if (start != null && (start < 0 || start > MAX_VIDEO_SECOND))
            errors.add("draft.startSecond.range");
        if (locked != null && (start == null || locked < start || locked > MAX_VIDEO_SECOND))
            errors.add("draft.lockedSecond.range");
        if (live != null && start != null && start > live)
            errors.add("draft.startSecond.afterGameStart");
        if (live != null && locked != null && locked > live)
            errors.add("draft.lockedSecond.afterGameStart");

        var heroes = new HashSet<String>();
        var counts = new EnumMap<Side, int[]>(Side.class);
        int previous = -1;
        for (int index = 0; index < draft.turns().size(); index++) {
            var turn = draft.turns().get(index);
            String field = "draft.turns[" + index + "]";
            if (turn.order() == null || turn.order() != index + 1)
                errors.add(field + ".order");
            if (turn.kind() == null)
                errors.add(field + ".kind");
            if (turn.side() == null)
                errors.add(field + ".side");
            if (turn.kind() == DraftKind.PICK && !present(turn.hero()))
                errors.add(field + ".hero");
            if (present(turn.hero())) {
                if (turn.hero().name() != null && turn.hero().name().length() > 200)
                    errors.add(field + ".hero.name.length");
                if (!heroes.add(identity(turn.hero())))
                    errors.add(field + ".hero.duplicate");
            }
            if (turn.side() != null && turn.kind() != null) {
                var count = counts.computeIfAbsent(turn.side(), ignored -> new int[2]);
                int kind = turn.kind() == DraftKind.BAN ? 0 : 1;
                if (++count[kind] > (kind == 0 ? 4 : 5))
                    errors.add(field + ".maximum");
            }
            if (turn.atSecond() != null) {
                if (start == null || turn.atSecond() < start || locked != null && turn.atSecond() > locked
                        || live != null && turn.atSecond() > live)
                    errors.add(field + ".atSecond.range");
                else if (turn.atSecond() < previous)
                    errors.add(field + ".atSecond.order");
                else
                    previous = turn.atSecond();
            }
        }
        if (draft.turns().isEmpty())
            return;

        // Final bans and line-ups must come from the recorded turns; teammates may still swap heroes among themselves.
        for (int sideIndex = 0; sideIndex < game.sides().size(); sideIndex++) {
            var side = game.sides().get(sideIndex);
            String path = "sides[" + sideIndex + "]";
            var bans = drafted(draft, side.side(), DraftKind.BAN);
            var picks = drafted(draft, side.side(), DraftKind.PICK);
            for (int index = 0; index < side.bans().size(); index++)
                if (present(side.bans().get(index)) && !bans.contains(identity(side.bans().get(index))))
                    errors.add(path + ".bans[" + index + "].notDrafted");
            for (int index = 0; index < side.participants().size(); index++) {
                var hero = side.participants().get(index).hero();
                if (present(hero) && !picks.contains(identity(hero)))
                    errors.add(path + ".participants[" + index + "].hero.notDrafted");
            }
        }
    }

    private static Set<String> drafted(GameDraft draft, Side side, DraftKind kind) {
        var heroes = new HashSet<String>();
        for (var turn : draft.turns())
            if (turn.side() == side && turn.kind() == kind && present(turn.hero()))
                heroes.add(identity(turn.hero()));
        return heroes;
    }

    private static void timeline(GameTimeline timeline, Integer duration, List<String> errors) {
        if (timeline.pauses().size() > 50 || timeline.events().size() > 1000) {
            errors.add("timeline.maximum");
            return;
        }
        int previous = -1;
        for (int index = 0; index < timeline.pauses().size(); index++) {
            var pause = timeline.pauses().get(index);
            String field = "timeline.pauses[" + index + "]";
            time(pause.atSeconds(), duration, field, errors);
            if (pause.atSeconds() != null) {
                if (pause.atSeconds() <= previous)
                    errors.add(field + ".time.order");
                previous = pause.atSeconds();
            }
            if (pause.durationSeconds() == null || pause.durationSeconds() < 1 || pause.durationSeconds() > 21600)
                errors.add(field + ".durationSeconds.range");
        }

        var ids = new HashSet<String>();
        previous = -1;
        for (int index = 0; index < timeline.events().size(); index++) {
            var event = timeline.events().get(index);
            String field = "timeline.events[" + index + "]";
            if (event.id() == null || !event.id().matches("[A-Za-z0-9:_-]{1,64}"))
                errors.add(field + ".id");
            else if (!ids.add(event.id()))
                errors.add(field + ".id.duplicate");
            time(event.atSeconds(), duration, field, errors);
            if (event.atSeconds() != null) {
                if (event.atSeconds() < previous)
                    errors.add(field + ".time.order");
                previous = event.atSeconds();
            }
            if (event.note() != null && event.note().length() > 500)
                errors.add(field + ".note.length");
            if (event.kind() == null) {
                errors.add(field + ".kind");
                continue;
            }
            switch (event.kind()) {
                case KILL -> kill(event, field, errors);
                case OBJECTIVE -> objective(event, field, errors);
                case NOTE -> note(event, field, errors);
            }
        }
    }

    private static void kill(TimelineEvent event, String path, List<String> errors) {
        if (event.side() != null || event.objective() != null || event.by() != null || event.title() != null)
            errors.add(path + ".fields.unexpected");
        if (event.killer() == null && event.victim() == null) {
            errors.add(path + ".kill.participant");
            return;
        }
        seat(event.killer(), path + ".killer", errors);
        seat(event.victim(), path + ".victim", errors);
        if (event.killer() != null && event.victim() != null && event.killer().side() == event.victim().side())
            errors.add(path + ".victim.sameSide");
        Side scoring = event.killer() != null
                ? event.killer().side()
                : event.victim().side() == null ? null : event.victim().side() == Side.BLUE ? Side.RED : Side.BLUE;
        var assists = new HashSet<Seat>();
        if (event.assists().size() > 4)
            errors.add(path + ".assists.maximum");
        for (int index = 0; index < event.assists().size(); index++) {
            var assist = event.assists().get(index);
            String field = path + ".assists[" + index + "]";
            seat(assist, field, errors);
            if (assist == null)
                continue;
            if (!assists.add(assist) || assist.equals(event.killer()))
                errors.add(field + ".duplicate");
            if (scoring != null && assist.side() != scoring)
                errors.add(field + ".side");
        }
    }

    private static void objective(TimelineEvent event, String path, List<String> errors) {
        if (event.killer() != null || event.victim() != null || !event.assists().isEmpty() || event.title() != null)
            errors.add(path + ".fields.unexpected");
        if (event.side() == null)
            errors.add(path + ".side");
        if (event.objective() == null)
            errors.add(path + ".objective");
        if (event.by() != null) {
            seat(event.by(), path + ".by", errors);
            if (event.side() != null && event.by().side() != event.side())
                errors.add(path + ".by.side");
        }
    }

    private static void note(TimelineEvent event, String path, List<String> errors) {
        if (event.killer() != null || event.victim() != null || !event.assists().isEmpty()
                || event.objective() != null || event.by() != null)
            errors.add(path + ".fields.unexpected");
        if (event.title() == null || event.title().isBlank() || event.title().length() > 120)
            errors.add(path + ".title");
    }

    private static void seat(Seat seat, String path, List<String> errors) {
        if (seat != null && (seat.side() == null || seat.lane() == null))
            errors.add(path);
    }

    private static void arcana(Loadout<ArcanaAllocation> loadout, String path, boolean publication, Catalog catalog,
            List<String> errors) {
        if (!observed(loadout)) {
            if (!loadout.entries().isEmpty())
                errors.add(path + ".unknownHasEntries");
            return;
        }
        boolean complete = publication && loadout.status() == ObservationStatus.KNOWN;
        var colors = new HashMap<String, Integer>();
        var ids = new HashSet<String>();
        int total = 0;
        for (int index = 0; index < loadout.entries().size(); index++) {
            var entry = loadout.entries().get(index);
            String field = path + ".entries[" + index + "]";
            selection(entry.selection(), complete, field + ".selection", errors,
                    catalog == null ? null : catalog.arcana());
            if (present(entry.selection()) && !ids.add(identity(entry.selection())))
                errors.add(field + ".duplicate");
            int count = entry.count() == null ? 0 : entry.count();
            if (count < 1 || count > 10)
                errors.add(field + ".count.range");
            total += count;
            String color = entry.color();
            var reference = reference(entry.selection(), catalog == null ? null : catalog.arcana());
            if (reference != null) {
                if (color != null && !color.equals(reference.color()))
                    errors.add(field + ".color.mismatch");
                color = reference.color();
            }
            if (color != null && Set.of("RED", "PURPLE", "GREEN").contains(color))
                colors.merge(color, count, Integer::sum);
            else if (complete || !present(entry.selection()))
                errors.add(field + ".color");
        }
        if (total > 30 || complete && total != 30)
            errors.add(path + ".total.thirty");
        for (var color : List.of("RED", "PURPLE", "GREEN"))
            if (colors.getOrDefault(color, 0) > 10 || complete && colors.getOrDefault(color, 0) != 10)
                errors.add(path + ".colors." + color + ".ten");
    }

    private static void enchantments(Loadout<EnchantmentAllocation> loadout, String path, boolean publication,
            Catalog catalog, List<String> errors) {
        if (!observed(loadout)) {
            if (!loadout.entries().isEmpty())
                errors.add(path + ".unknownHasEntries");
            return;
        }
        boolean complete = publication && loadout.status() == ObservationStatus.KNOWN;
        if (loadout.entries().size() > 5)
            errors.add(path + ".maximum");
        var primary = new HashMap<Integer, String>();
        var secondary = new ArrayList<Map.Entry<Integer, String>>();
        var ids = new HashSet<String>();
        for (int index = 0; index < loadout.entries().size(); index++) {
            var entry = loadout.entries().get(index);
            String field = path + ".entries[" + index + "]";
            selection(entry.selection(), complete, field + ".selection", errors,
                    catalog == null ? null : catalog.enchantments());
            if (present(entry.selection()) && !ids.add(identity(entry.selection())))
                errors.add(field + ".duplicate");
            int tier = entry.tier() == null ? 0 : entry.tier();
            String branch = entry.branchCode();
            var reference = reference(entry.selection(), catalog == null ? null : catalog.enchantments());
            if (reference != null) {
                if (entry.tier() != null && !entry.tier().equals(reference.tier()))
                    errors.add(field + ".tier.mismatch");
                if (branch != null && !branch.equals(reference.branchCode()))
                    errors.add(field + ".branch.mismatch");
                tier = reference.tier() == null ? 0 : reference.tier();
                branch = reference.branchCode();
            }
            if (tier < 1 || tier > 3 || !entry.primary() && tier > 2)
                errors.add(field + ".tier.range");
            if (branch == null || branch.isBlank()) {
                if (complete)
                    errors.add(field + ".branchCode");
                branch = "unknown";
            }
            if (entry.primary()) {
                if (primary.put(tier, branch) != null)
                    errors.add(field + ".primaryTier.duplicate");
            } else
                secondary.add(Map.entry(tier, branch));
        }
        if (complete && (primary.size() != 3 || secondary.size() != 2))
            errors.add(path + ".primaryThree.secondaryTwo");
        if (new HashSet<>(primary.values()).size() > 1)
            errors.add(path + ".primary.sameBranch");
        String main = primary.values().stream().findFirst().orElse(null);
        if (secondary.stream().anyMatch(entry -> entry.getValue().equals(main)))
            errors.add(path + ".secondary.differentBranch");
        if (secondary.size() == 2) {
            var first = secondary.get(0);
            var second = secondary.get(1);
            if (first.getValue().equals(second.getValue())) {
                if (!new HashSet<>(List.of(first.getKey(), second.getKey())).equals(Set.of(1, 2)))
                    errors.add(path + ".secondary.tiersOneTwo");
            } else if (first.getKey() != 1 || second.getKey() != 1)
                errors.add(path + ".secondary.mixedTierOne");
        }
    }

    private static void equipment(Participant participant, String path, boolean publication, Integer duration,
            Catalog catalog, List<String> errors) {
        if (participant.equipmentSnapshots().size() > 1000 || participant.equipmentEvents().size() > 2000) {
            errors.add(path + ".equipment.maximum");
            return;
        }
        int previous = -1;
        for (int index = 0; index < participant.equipmentSnapshots().size(); index++) {
            var snapshot = participant.equipmentSnapshots().get(index);
            String field = path + ".equipmentSnapshots[" + index + "]";
            time(snapshot.atSeconds(), duration, field, errors);
            if (snapshot.atSeconds() != null) {
                if (snapshot.atSeconds() <= previous)
                    errors.add(field + ".time.order");
                previous = snapshot.atSeconds();
            }
            if (snapshot.slots().size() > 6 || publication && snapshot.slots().size() != 6)
                errors.add(field + ".slots.six");
            var slots = new HashSet<Integer>();
            for (var slot : snapshot.slots()) {
                if (!validSlot(slot.slot()) || !slots.add(slot.slot()))
                    errors.add(field + ".slot.uniqueOneToSix");
                if (!slot.known() && present(slot.item()))
                    errors.add(field + ".slot.unknownHasItem");
                if (present(slot.item()))
                    selection(slot.item(), publication, field + ".item", errors,
                            catalog == null ? null : catalog.items());
            }
        }
        previous = -1;
        for (int index = 0; index < participant.equipmentEvents().size(); index++) {
            var event = participant.equipmentEvents().get(index);
            String field = path + ".equipmentEvents[" + index + "]";
            time(event.atSeconds(), duration, field, errors);
            if (event.atSeconds() != null) {
                if (event.atSeconds() < previous)
                    errors.add(field + ".time.order");
                previous = event.atSeconds();
            }
            if (event.type() == null) {
                errors.add(field + ".type");
                continue;
            }
            if (event.type() == EventType.SWAP) {
                if (!validSlot(event.fromSlot()) || !validSlot(event.toSlot())
                        || event.fromSlot().equals(event.toSlot()))
                    errors.add(field + ".swap.slots");
            } else {
                selection(event.item(), true, field + ".item", errors, catalog == null ? null : catalog.items());
                if (event.type() == EventType.SELL && !validSlot(event.fromSlot())
                        || event.type() != EventType.SELL && !validSlot(event.toSlot()))
                    errors.add(field + ".slot");
            }
            if (present(event.replacedItem()))
                selection(event.replacedItem(), publication, field + ".replacedItem", errors,
                        catalog == null ? null : catalog.items());
        }
    }

    private static boolean observed(Loadout<?> loadout) {
        return loadout.status() == ObservationStatus.KNOWN || loadout.status() == ObservationStatus.PARTIAL;
    }

    private static void observed(Integer seconds, Integer duration, String path, List<String> errors) {
        if (seconds != null && (seconds < 0 || seconds > 86400 || duration != null && seconds > duration))
            errors.add(path + ".range");
    }

    private static void time(Integer seconds, Integer duration, String path, List<String> errors) {
        if (seconds == null || seconds < 0 || seconds > 86400 || duration != null && seconds > duration)
            errors.add(path + ".atSeconds.range");
    }

    private static boolean validSlot(Integer slot) {
        return slot != null && slot >= 1 && slot <= 6;
    }

    private static void selection(Selection selection, boolean required, String path, List<String> errors,
            List<Reference> references) {
        if (!present(selection)) {
            if (required)
                errors.add(path);
            return;
        }
        if (selection.name() != null && selection.name().length() > 200)
            errors.add(path + ".name.length");
        if (required && selection.id() != null && references != null && reference(selection, references) == null)
            errors.add(path + ".unavailableInPatch");
    }

    private static Reference reference(Selection selection, List<Reference> references) {
        return selection == null || selection.id() == null || references == null
                ? null
                : references.stream().filter(reference -> reference.id().equals(selection.id())).findFirst()
                        .orElse(null);
    }

    private static boolean present(Selection selection) {
        return selection != null && selection.present();
    }

    private static String identity(Selection selection) {
        return selection.id() != null
                ? selection.id().toString()
                : Normalizer.normalize(selection.name().trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFKC);
    }

    private static void require(boolean valid, String path, List<String> errors) {
        if (!valid)
            errors.add(path);
    }
}
