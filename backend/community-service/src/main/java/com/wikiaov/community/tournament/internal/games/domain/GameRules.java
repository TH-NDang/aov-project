package com.wikiaov.community.tournament.internal.games.domain;

import com.wikiaov.community.tournament.internal.domain.CatalogLocales;
import com.wikiaov.community.tournament.internal.domain.SourceUrls;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.ArcanaAllocation;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildPlace;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildStep;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftKind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EnchantmentAllocation;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EventType;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.GameDraft;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.GameTimeline;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Loadout;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.ObservationStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Participant;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Reference;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Seat;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TimelineEvent;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public final class GameRules {
    public static final int MAX_GAME_NUMBER = 99;
    public static final int MAX_DRAFT_TURNS = 40;
    public static final int MAX_PAUSES = 50;
    public static final int MAX_TIMELINE_EVENTS = 1000;
    /** Longest pause of a game, six hours. */
    public static final int MAX_PAUSE_SECONDS = 21_600;
    /** Latest game second an observation can name, one day. */
    public static final int MAX_GAME_SECOND = 86_400;
    /** Names of picks and selections. */
    public static final int MAX_NAME = 200;
    public static final int SIDES = 2;
    public static final int BANS_PER_SIDE = 4;
    public static final int PLAYERS_PER_SIDE = 5;
    public static final int MAX_ASSISTS = PLAYERS_PER_SIDE - 1;
    public static final int MAX_EVENT_NOTE = 500;
    public static final int MAX_EVENT_TITLE = 120;
    /** Arcana: at most ten of one kind and ten of each colour, thirty in a full page. */
    public static final int MAX_ARCANA_COUNT = 10;
    public static final int ARCANA_PER_COLOR = 10;
    public static final int ARCANA_TOTAL = 30;
    public static final List<String> ARCANA_COLORS = List.of("RED", "PURPLE", "GREEN");
    /** Enchantments: three of the primary branch, two of the secondary one, tiers 1 to 3. */
    public static final int MAX_ENCHANTMENTS = 5;
    public static final int PRIMARY_ENCHANTMENTS = 3;
    public static final int SECONDARY_ENCHANTMENTS = 2;
    public static final int MAX_ENCHANTMENT_TIER = 3;
    public static final int MAX_SECONDARY_TIER = 2;
    public static final int INVENTORY_SLOTS = 6;
    public static final int MAX_EQUIPMENT_SNAPSHOTS = 1000;
    public static final int MAX_EQUIPMENT_EVENTS = 2000;
    /** A build: at most this many items, none of the lowest tier, each made of at most three others. */
    public static final int MAX_BUILD_STEPS = 24;
    public static final int MAX_BUILD_PARTS = 3;
    public static final int MIN_BUILD_TIER = 2;

    private GameRules() {
    }

    /**
     * What is wrong with a game. A publication also needs the match, the two teams and the ten heroes with their lanes;
     * a player, a spell or a ban that nobody saw stays unknown and holds nothing back.
     */
    public static List<String> violations(Game game, boolean publication, Catalog catalog) {
        var errors = new ArrayList<String>();
        if (game == null) {
            return List.of("content");
        }
        metadata(game, publication, errors);

        var seen = new Seen();
        for (int sideIndex = 0; sideIndex < game.sides().size(); sideIndex++) {
            side(game, sideIndex, publication, catalog, seen, errors);
        }
        for (var hero : seen.heroes()) {
            if (seen.bans().contains(hero)) {
                errors.add("sides.hero.alreadyBanned");
            }
        }
        timeline(game.timeline(), game.durationSeconds(), errors);
        draft(game, publication, errors);
        return List.copyOf(errors);
    }

    /** What the sides of a game must not repeat: a side, a team, a player, a ban or a pick. */
    private record Seen(
            Set<Side> sides,
            Set<UUID> teams,
            Set<UUID> players,
            Set<String> bans,
            Set<String> heroes
    ) {
        Seen() {
            this(new HashSet<>(), new HashSet<>(), new HashSet<>(), new HashSet<>(), new HashSet<>());
        }
    }

    private static void metadata(Game game, boolean publication, List<String> errors) {
        if (!SourceUrls.valid(game.sourceUrl())) {
            errors.add("sourceUrl.invalid");
        }
        if (game.number() != null && (game.number() < 1 || game.number() > MAX_GAME_NUMBER)) {
            errors.add("number.range");
        }
        if (game.durationSeconds() != null && game.durationSeconds() < 0) {
            errors.add("durationSeconds.range");
        }
        // A draft may leave the locale open, but a locale the catalog cannot answer would hide every reference.
        if (game.locale() != null && !game.locale().isBlank() && !CatalogLocales.supported(game.locale())) {
            errors.add("locale.unsupported");
        }
        if (game.sides().size() > SIDES) {
            errors.add("sides.maximum");
        }
        if (publication) {
            require(game.seriesId() != null, "seriesId", errors);
            require(game.number() != null, "number", errors);
            require(game.region() != null && !game.region().isBlank(), "region", errors);
            require(game.locale() != null && !game.locale().isBlank(), "locale", errors);
            require(game.sides().size() == SIDES, "sides.two", errors);
        }
    }

    private static void side(Game game, int sideIndex, boolean publication, Catalog catalog, Seen seen,
            List<String> errors) {
        var side = game.sides().get(sideIndex);
        String path = "sides[" + sideIndex + "]";
        if (side.side() != null && !seen.sides().add(side.side())) {
            errors.add(path + ".side.duplicate");
        }
        if (side.teamId() != null && !seen.teams().add(side.teamId())) {
            errors.add(path + ".teamId.duplicate");
        }
        if (side.bans().size() > BANS_PER_SIDE) {
            errors.add(path + ".bans.maximum");
        }
        if (side.participants().size() > PLAYERS_PER_SIDE) {
            errors.add(path + ".participants.maximum");
        }
        if (publication) {
            require(side.side() != null, path + ".side", errors);
            require(side.teamId() != null, path + ".teamId", errors);
            require(side.participants().size() == PLAYERS_PER_SIDE, path + ".participants.five", errors);
        }

        for (int banIndex = 0; banIndex < side.bans().size(); banIndex++) {
            var ban = side.bans().get(banIndex);
            String field = path + ".bans[" + banIndex + "]";
            observed(ban, publication, field, errors, catalog == null ? null : catalog.heroes());
            if (present(ban) && !seen.bans().add(identity(ban))) {
                errors.add(field + ".duplicate");
            }
        }
        var lanes = new HashSet<Lane>();
        for (int index = 0; index < side.participants().size(); index++) {
            var participant = side.participants().get(index);
            String field = path + ".participants[" + index + "]";
            if (participant.playerId() != null && !seen.players().add(participant.playerId())) {
                errors.add(field + ".playerId.duplicate");
            }
            if (participant.lane() != null && !lanes.add(participant.lane())) {
                errors.add(field + ".lane.duplicate");
            }
            participant(participant, field, game.durationSeconds(), publication, catalog, seen, errors);
        }
    }

    private static void participant(Participant participant, String field, Integer duration, boolean publication,
            Catalog catalog, Seen seen, List<String> errors) {
        if (publication) {
            require(participant.lane() != null, field + ".lane", errors);
        }
        selection(participant.hero(), publication, field + ".hero", errors,
                catalog == null ? null : catalog.heroes());
        observed(participant.spell(), publication, field + ".spell", errors,
                catalog == null ? null : catalog.spells());
        if (present(participant.hero()) && !seen.heroes().add(identity(participant.hero()))) {
            errors.add(field + ".hero.duplicate");
        }
        arcana(participant.arcana(), field + ".arcana", publication, catalog, errors);
        enchantments(participant.enchantments(), field + ".enchantments", publication, catalog, errors);
        observed(participant.spellObservedAtSeconds(), duration, field + ".spellObservedAtSeconds", errors);
        observed(participant.arcana().observedAtSeconds(), duration, field + ".arcana.observedAtSeconds", errors);
        observed(participant.enchantments().observedAtSeconds(), duration, field + ".enchantments.observedAtSeconds",
                errors);
        equipment(participant, field, publication, duration, catalog, errors);
    }

    /** Longest video position accepted for draft marks, matching a two-day live stream. */
    private static final int MAX_VIDEO_SECOND = 172_800;

    private static void draft(Game game, boolean publication, List<String> errors) {
        var draft = game.draft();
        if (draft.turns().size() > MAX_DRAFT_TURNS) {
            errors.add("draft.maximum");
            return;
        }
        draftMarks(draft, game.sourceTimestampSeconds(), errors);

        var heroes = new HashSet<String>();
        var counts = new EnumMap<Side, int[]>(Side.class);
        int previous = -1;
        for (int index = 0; index < draft.turns().size(); index++) {
            previous = turn(draft, index, game.sourceTimestampSeconds(), heroes, counts, previous, errors);
        }
        if (draft.turns().isEmpty()) {
            return;
        }

        draftedLineups(game, draft, errors);
        if (publication) {
            draftedBans(game, draft, errors);
        }
    }

    /** The marks of the draft phase on the video: it starts, then locks, both before the game starts. */
    private static void draftMarks(GameDraft draft, Integer live, List<String> errors) {
        Integer start = draft.startSecond();
        Integer locked = draft.lockedSecond();
        if (start != null && (start < 0 || start > MAX_VIDEO_SECOND)) {
            errors.add("draft.startSecond.range");
        }
        if (locked != null && (start == null || locked < start || locked > MAX_VIDEO_SECOND)) {
            errors.add("draft.lockedSecond.range");
        }
        if (live != null && start != null && start > live) {
            errors.add("draft.startSecond.afterGameStart");
        }
        if (live != null && locked != null && locked > live) {
            errors.add("draft.lockedSecond.afterGameStart");
        }
    }

    /** Checks one turn and returns the video second the next turn may not precede. */
    private static int turn(GameDraft draft, int index, Integer live, Set<String> heroes, Map<Side, int[]> counts,
            int previous, List<String> errors) {
        var turn = draft.turns().get(index);
        String field = "draft.turns[" + index + "]";
        if (turn.order() == null || turn.order() != index + 1) {
            errors.add(field + ".order");
        }
        if (turn.kind() == null) {
            errors.add(field + ".kind");
        }
        if (turn.side() == null) {
            errors.add(field + ".side");
        }
        if (turn.kind() == DraftKind.PICK && !present(turn.hero())) {
            errors.add(field + ".hero");
        }
        if (present(turn.hero())) {
            if (turn.hero().name() != null && turn.hero().name().length() > MAX_NAME) {
                errors.add(field + ".hero.name.length");
            }
            if (!heroes.add(identity(turn.hero()))) {
                errors.add(field + ".hero.duplicate");
            }
        }
        if (turn.side() != null && turn.kind() != null) {
            var count = counts.computeIfAbsent(turn.side(), ignored -> new int[2]);
            int kind = turn.kind() == DraftKind.BAN ? 0 : 1;
            if (++count[kind] > (kind == 0 ? BANS_PER_SIDE : PLAYERS_PER_SIDE)) {
                errors.add(field + ".maximum");
            }
        }

        if (turn.atSecond() == null) {
            return previous;
        }
        Integer start = draft.startSecond();
        Integer locked = draft.lockedSecond();
        if (start == null || turn.atSecond() < start || locked != null && turn.atSecond() > locked
                || live != null && turn.atSecond() > live) {
            errors.add(field + ".atSecond.range");
        } else if (turn.atSecond() < previous) {
            errors.add(field + ".atSecond.order");
        } else {
            return turn.atSecond();
        }
        return previous;
    }

    /** Final bans and line-ups must come from the recorded turns; teammates may still swap heroes among themselves. */
    private static void draftedLineups(Game game, GameDraft draft, List<String> errors) {
        for (int sideIndex = 0; sideIndex < game.sides().size(); sideIndex++) {
            var side = game.sides().get(sideIndex);
            String path = "sides[" + sideIndex + "]";
            var bans = drafted(draft, side.side(), DraftKind.BAN);
            var picks = drafted(draft, side.side(), DraftKind.PICK);
            for (int index = 0; index < side.bans().size(); index++) {
                if (present(side.bans().get(index)) && !bans.contains(identity(side.bans().get(index)))) {
                    errors.add(path + ".bans[" + index + "].notDrafted");
                }
            }
            for (int index = 0; index < side.participants().size(); index++) {
                var hero = side.participants().get(index).hero();
                if (present(hero) && !picks.contains(identity(hero))) {
                    errors.add(path + ".participants[" + index + "].hero.notDrafted");
                }
            }
        }
    }

    /** A hero banned in a turn is among the bans of that side, which is what the statistics count. */
    private static void draftedBans(Game game, GameDraft draft, List<String> errors) {
        for (int index = 0; index < draft.turns().size(); index++) {
            var turn = draft.turns().get(index);
            if (turn.kind() != DraftKind.BAN || !present(turn.hero())) {
                continue;
            }
            boolean listed = game.sides().stream().filter(side -> side.side() == turn.side())
                    .flatMap(side -> side.bans().stream())
                    .anyMatch(ban -> present(ban) && identity(ban).equals(identity(turn.hero())));
            if (!listed) {
                errors.add("draft.turns[" + index + "].hero.notBanned");
            }
        }
    }

    private static Set<String> drafted(GameDraft draft, Side side, DraftKind kind) {
        var heroes = new HashSet<String>();
        for (var turn : draft.turns()) {
            if (turn.side() == side && turn.kind() == kind && present(turn.hero())) {
                heroes.add(identity(turn.hero()));
            }
        }
        return heroes;
    }

    private static void timeline(GameTimeline timeline, Integer duration, List<String> errors) {
        if (timeline.pauses().size() > MAX_PAUSES || timeline.events().size() > MAX_TIMELINE_EVENTS) {
            errors.add("timeline.maximum");
            return;
        }
        int previous = -1;
        for (int index = 0; index < timeline.pauses().size(); index++) {
            var pause = timeline.pauses().get(index);
            String field = "timeline.pauses[" + index + "]";
            time(pause.atSeconds(), duration, field, errors);
            if (pause.atSeconds() != null) {
                if (pause.atSeconds() <= previous) {
                    errors.add(field + ".time.order");
                }
                previous = pause.atSeconds();
            }
            if (pause.durationSeconds() == null || pause.durationSeconds() < 1
                    || pause.durationSeconds() > MAX_PAUSE_SECONDS) {
                errors.add(field + ".durationSeconds.range");
            }
        }

        var ids = new HashSet<String>();
        previous = -1;
        for (int index = 0; index < timeline.events().size(); index++) {
            var event = timeline.events().get(index);
            String field = "timeline.events[" + index + "]";
            if (event.id() == null || !event.id().matches("[A-Za-z0-9:_-]{1,64}")) {
                errors.add(field + ".id");
            } else if (!ids.add(event.id())) {
                errors.add(field + ".id.duplicate");
            }
            time(event.atSeconds(), duration, field, errors);
            if (event.atSeconds() != null) {
                if (event.atSeconds() < previous) {
                    errors.add(field + ".time.order");
                }
                previous = event.atSeconds();
            }
            if (event.note() != null && event.note().length() > MAX_EVENT_NOTE) {
                errors.add(field + ".note.length");
            }
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
        if (event.side() != null || event.objective() != null || event.by() != null || event.title() != null) {
            errors.add(path + ".fields.unexpected");
        }
        if (event.killer() == null && event.victim() == null) {
            errors.add(path + ".kill.participant");
            return;
        }
        seat(event.killer(), path + ".killer", errors);
        seat(event.victim(), path + ".victim", errors);
        if (event.killer() != null && event.victim() != null && event.killer().side() == event.victim().side()) {
            errors.add(path + ".victim.sameSide");
        }
        Side scoring = event.killer() != null
                ? event.killer().side()
                : event.victim().side() == null ? null : event.victim().side() == Side.BLUE ? Side.RED : Side.BLUE;
        var assists = new HashSet<Seat>();
        if (event.assists().size() > MAX_ASSISTS) {
            errors.add(path + ".assists.maximum");
        }
        for (int index = 0; index < event.assists().size(); index++) {
            var assist = event.assists().get(index);
            String field = path + ".assists[" + index + "]";
            seat(assist, field, errors);
            if (assist == null) {
                continue;
            }
            if (!assists.add(assist) || assist.equals(event.killer())) {
                errors.add(field + ".duplicate");
            }
            if (scoring != null && assist.side() != scoring) {
                errors.add(field + ".side");
            }
        }
    }

    private static void objective(TimelineEvent event, String path, List<String> errors) {
        if (event.killer() != null || event.victim() != null || !event.assists().isEmpty() || event.title() != null) {
            errors.add(path + ".fields.unexpected");
        }
        if (event.side() == null) {
            errors.add(path + ".side");
        }
        if (event.objective() == null) {
            errors.add(path + ".objective");
        }
        if (event.by() != null) {
            seat(event.by(), path + ".by", errors);
            if (event.side() != null && event.by().side() != event.side()) {
                errors.add(path + ".by.side");
            }
        }
    }

    private static void note(TimelineEvent event, String path, List<String> errors) {
        if (event.killer() != null || event.victim() != null || !event.assists().isEmpty()
                || event.objective() != null || event.by() != null) {
            errors.add(path + ".fields.unexpected");
        }
        if (event.title() == null || event.title().isBlank() || event.title().length() > MAX_EVENT_TITLE) {
            errors.add(path + ".title");
        }
    }

    private static void seat(Seat seat, String path, List<String> errors) {
        if (seat != null && (seat.side() == null || seat.lane() == null)) {
            errors.add(path);
        }
    }

    private static void arcana(Loadout<ArcanaAllocation> loadout, String path, boolean publication, Catalog catalog,
            List<String> errors) {
        if (!observed(loadout)) {
            if (!loadout.entries().isEmpty()) {
                errors.add(path + ".unknownHasEntries");
            }
            return;
        }
        boolean complete = publication && loadout.status() == ObservationStatus.KNOWN;
        var colors = new HashMap<String, Integer>();
        var ids = new HashSet<String>();
        int total = 0;
        for (int index = 0; index < loadout.entries().size(); index++) {
            var entry = loadout.entries().get(index);
            String field = path + ".entries[" + index + "]";
            part(entry.selection(), complete, publication, field + ".selection", errors,
                    catalog == null ? null : catalog.arcana());
            if (present(entry.selection()) && !ids.add(identity(entry.selection()))) {
                errors.add(field + ".duplicate");
            }
            int count = entry.count() == null ? 0 : entry.count();
            if (count < 1 || count > MAX_ARCANA_COUNT) {
                errors.add(field + ".count.range");
            }
            total += count;
            String color = entry.color();
            var reference = reference(entry.selection(), catalog == null ? null : catalog.arcana());
            if (reference != null) {
                if (color != null && !color.equals(reference.color())) {
                    errors.add(field + ".color.mismatch");
                }
                color = reference.color();
            }
            if (color != null && ARCANA_COLORS.contains(color)) {
                colors.merge(color, count, Integer::sum);
            } else if (complete || !present(entry.selection())) {
                errors.add(field + ".color");
            }
        }
        if (total > ARCANA_TOTAL || complete && total != ARCANA_TOTAL) {
            errors.add(path + ".total.thirty");
        }
        for (var color : ARCANA_COLORS) {
            if (colors.getOrDefault(color, 0) > ARCANA_PER_COLOR
                    || complete && colors.getOrDefault(color, 0) != ARCANA_PER_COLOR) {
                errors.add(path + ".colors." + color + ".ten");
            }
        }
    }

    private static void enchantments(Loadout<EnchantmentAllocation> loadout, String path, boolean publication,
            Catalog catalog, List<String> errors) {
        if (!observed(loadout)) {
            if (!loadout.entries().isEmpty()) {
                errors.add(path + ".unknownHasEntries");
            }
            return;
        }
        boolean complete = publication && loadout.status() == ObservationStatus.KNOWN;
        if (loadout.entries().size() > MAX_ENCHANTMENTS) {
            errors.add(path + ".maximum");
        }
        var primary = new HashMap<Integer, String>();
        var secondary = new ArrayList<Map.Entry<Integer, String>>();
        var ids = new HashSet<String>();
        for (int index = 0; index < loadout.entries().size(); index++) {
            var entry = loadout.entries().get(index);
            String field = path + ".entries[" + index + "]";
            part(entry.selection(), complete, publication, field + ".selection", errors,
                    catalog == null ? null : catalog.enchantments());
            if (present(entry.selection()) && !ids.add(identity(entry.selection()))) {
                errors.add(field + ".duplicate");
            }
            int tier = entry.tier() == null ? 0 : entry.tier();
            String branch = entry.branchCode();
            var reference = reference(entry.selection(), catalog == null ? null : catalog.enchantments());
            if (reference != null) {
                if (entry.tier() != null && !entry.tier().equals(reference.tier())) {
                    errors.add(field + ".tier.mismatch");
                }
                if (branch != null && !branch.equals(reference.branchCode())) {
                    errors.add(field + ".branch.mismatch");
                }
                tier = reference.tier() == null ? 0 : reference.tier();
                branch = reference.branchCode();
            }
            if (tier < 1 || tier > MAX_ENCHANTMENT_TIER || !entry.primary() && tier > MAX_SECONDARY_TIER) {
                errors.add(field + ".tier.range");
            }
            if (branch == null || branch.isBlank()) {
                if (complete) {
                    errors.add(field + ".branchCode");
                }
                branch = "unknown";
            }
            if (entry.primary()) {
                if (primary.put(tier, branch) != null) {
                    errors.add(field + ".primaryTier.duplicate");
                }
            } else {
                secondary.add(Map.entry(tier, branch));
            }
        }
        if (complete && (primary.size() != PRIMARY_ENCHANTMENTS || secondary.size() != SECONDARY_ENCHANTMENTS)) {
            errors.add(path + ".primaryThree.secondaryTwo");
        }
        if (new HashSet<>(primary.values()).size() > 1) {
            errors.add(path + ".primary.sameBranch");
        }
        secondaryBranch(primary, secondary, path, errors);
    }

    /**
     * The secondary enchantments come from another branch than the primary ones: tiers 1 and 2 of one branch, or tier 1
     * of two branches.
     */
    private static void secondaryBranch(Map<Integer, String> primary, List<Map.Entry<Integer, String>> secondary,
            String path, List<String> errors) {
        String main = primary.values().stream().findFirst().orElse(null);
        if (secondary.stream().anyMatch(entry -> entry.getValue().equals(main))) {
            errors.add(path + ".secondary.differentBranch");
        }
        if (secondary.size() == SECONDARY_ENCHANTMENTS) {
            var first = secondary.get(0);
            var second = secondary.get(1);
            if (first.getValue().equals(second.getValue())) {
                if (!new HashSet<>(List.of(first.getKey(), second.getKey())).equals(Set.of(1, 2))) {
                    errors.add(path + ".secondary.tiersOneTwo");
                }
            } else if (first.getKey() != 1 || second.getKey() != 1) {
                errors.add(path + ".secondary.mixedTierOne");
            }
        }
    }

    private static void equipment(Participant participant, String path, boolean publication, Integer duration,
            Catalog catalog, List<String> errors) {
        if (participant.equipmentSnapshots().size() > MAX_EQUIPMENT_SNAPSHOTS
                || participant.equipmentEvents().size() > MAX_EQUIPMENT_EVENTS) {
            errors.add(path + ".equipment.maximum");
            return;
        }
        equipmentSnapshots(participant, path, publication, duration, catalog, errors);
        equipmentEvents(participant, path, publication, duration, catalog, errors);
        build(participant, path + ".build", publication, duration, catalog, errors);
    }

    /** The items a player built, each of them once; no more of them are held at the end than an inventory has slots. */
    private static void build(Participant participant, String path, boolean publication, Integer duration,
            Catalog catalog, List<String> errors) {
        if (participant.build().size() > MAX_BUILD_STEPS) {
            errors.add(path + ".maximum");
            return;
        }

        var references = catalog == null ? null : catalog.items();
        var items = new HashSet<String>();
        int kept = 0;
        for (int index = 0; index < participant.build().size(); index++) {
            var step = participant.build().get(index);
            String field = path + "[" + index + "]";
            buildItem(step.item(), publication, field + ".item", references, errors);
            if (present(step.item()) && !items.add(identity(step.item()))) {
                errors.add(field + ".item.duplicate");
            }
            buildParts(step, publication, field + ".from", references, errors);
            if (step.atSeconds() != null) {
                time(step.atSeconds(), duration, field, errors);
            }
            if (step.place() == BuildPlace.KEPT && ++kept > INVENTORY_SLOTS) {
                errors.add(field + ".kept.maximum");
            }
        }
    }

    private static void buildParts(BuildStep step, boolean publication, String path, List<Reference> references,
            List<String> errors) {
        if (step.from().size() > MAX_BUILD_PARTS) {
            errors.add(path + ".maximum");
            return;
        }

        var item = reference(step.item(), references);
        var parts = new HashSet<String>();
        for (int index = 0; index < step.from().size(); index++) {
            var part = step.from().get(index);
            String field = path + "[" + index + "]";
            buildItem(part, publication, field, references, errors);
            if (present(part) && !parts.add(identity(part))) {
                errors.add(field + ".duplicate");
            }
            if (present(part) && present(step.item()) && identity(part).equals(identity(step.item()))) {
                errors.add(field + ".same");
            } else if (!growsInto(reference(part, references), item)) {
                errors.add(field + ".notLower");
            }
        }
    }

    /**
     * Whether an item can have grown from a part: one of a lower tier, or one that its recipe names. What the catalog
     * does not know holds nothing back. Recipes come with the catalog of the wiki, not with the one frozen in a game.
     */
    private static boolean growsInto(@Nullable Reference part, @Nullable Reference item) {
        if (part == null || item == null || part.tier() == null || item.tier() == null) {
            return true;
        }
        return part.tier() < item.tier() || item.components().contains(part.id());
    }

    private static void buildItem(Selection item, boolean publication, String path, List<Reference> references,
            List<String> errors) {
        selection(item, true, path, errors, publication ? references : null);
        var known = reference(item, references);
        if (known != null && known.tier() != null && known.tier() < MIN_BUILD_TIER) {
            errors.add(path + ".tier");
        }
    }

    private static void equipmentSnapshots(Participant participant, String path, boolean publication,
            Integer duration, Catalog catalog, List<String> errors) {
        int previous = -1;
        for (int index = 0; index < participant.equipmentSnapshots().size(); index++) {
            var snapshot = participant.equipmentSnapshots().get(index);
            String field = path + ".equipmentSnapshots[" + index + "]";
            time(snapshot.atSeconds(), duration, field, errors);
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
                if (!slot.known() && present(slot.item())) {
                    errors.add(field + ".slot.unknownHasItem");
                }
                if (present(slot.item())) {
                    selection(slot.item(), publication, field + ".item", errors,
                            catalog == null ? null : catalog.items());
                }
            }
        }
    }

    private static void equipmentEvents(Participant participant, String path, boolean publication, Integer duration,
            Catalog catalog, List<String> errors) {
        int previous = -1;
        for (int index = 0; index < participant.equipmentEvents().size(); index++) {
            var event = participant.equipmentEvents().get(index);
            String field = path + ".equipmentEvents[" + index + "]";
            time(event.atSeconds(), duration, field, errors);
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
                selection(event.item(), true, field + ".item", errors, catalog == null ? null : catalog.items());
                if (event.type() == EventType.SELL && !validSlot(event.fromSlot())
                        || event.type() != EventType.SELL && !validSlot(event.toSlot())) {
                    errors.add(field + ".slot");
                }
            }
            if (present(event.replacedItem())) {
                selection(event.replacedItem(), publication, field + ".replacedItem", errors,
                        catalog == null ? null : catalog.items());
            }
        }
    }

    private static boolean observed(Loadout<?> loadout) {
        return loadout.status() == ObservationStatus.KNOWN || loadout.status() == ObservationStatus.PARTIAL;
    }

    private static void observed(Integer seconds, Integer duration, String path, List<String> errors) {
        if (seconds != null && (seconds < 0 || seconds > MAX_GAME_SECOND || duration != null && seconds > duration)) {
            errors.add(path + ".range");
        }
    }

    private static void time(Integer seconds, Integer duration, String path, List<String> errors) {
        if (seconds == null || seconds < 0 || seconds > MAX_GAME_SECOND || duration != null && seconds > duration) {
            errors.add(path + ".atSeconds.range");
        }
    }

    private static boolean validSlot(Integer slot) {
        return slot != null && slot >= 1 && slot <= INVENTORY_SLOTS;
    }

    private static void selection(Selection selection, boolean required, String path, List<String> errors,
            List<Reference> references) {
        if (!present(selection)) {
            if (required) {
                errors.add(path);
            }
            return;
        }
        if (selection.name() != null && selection.name().length() > MAX_NAME) {
            errors.add(path + ".name.length");
        }
        if (required && selection.id() != null && references != null && reference(selection, references) == null) {
            errors.add(path + ".unavailableInPatch");
        }
    }

    /** A selection the source may not have shown: it may be missing, but one that is named must be right. */
    private static void observed(Selection selection, boolean publication, String path, List<String> errors,
            List<Reference> references) {
        if (present(selection)) {
            selection(selection, publication, path, errors, references);
        }
    }

    /** A part of a loadout: needed once the whole loadout was seen, and right in any case. */
    private static void part(Selection selection, boolean complete, boolean publication, String path,
            List<String> errors, List<Reference> references) {
        if (complete || present(selection)) {
            selection(selection, publication, path, errors, references);
        }
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

    /** What makes two selections the same one: the id, or the name, in any case, of one recorded without an id. */
    public static String identity(Selection selection) {
        return selection.id() != null
                ? selection.id().toString()
                : Normalizer.normalize(selection.name().trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFKC);
    }

    private static void require(boolean valid, String path, List<String> errors) {
        if (!valid) {
            errors.add(path);
        }
    }
}
