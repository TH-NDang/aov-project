package com.wikiaov.community.tournament.internal.games.domain;

import com.wikiaov.community.tournament.internal.domain.GameContent.DraftKind;
import com.wikiaov.community.tournament.internal.domain.GameContent.Game;
import com.wikiaov.community.tournament.internal.domain.GameContent.GameDraft;
import com.wikiaov.community.tournament.internal.domain.GameContent.Side;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** The ban/pick phase of a game: its marks on the video, its turns and the line-ups the turns produce. */
final class DraftRules {
    static final int MAX_DRAFT_TURNS = 40;
    /** Longest video position accepted for draft marks, matching a two-day live stream. */
    static final int MAX_VIDEO_SECOND = 172_800;

    private DraftRules() {
    }

    static void check(Game game, List<String> errors) {
        var draft = game.draft();
        if (draft.turns().size() > MAX_DRAFT_TURNS) {
            errors.add("draft.maximum");
            return;
        }
        marks(draft, game.sourceTimestampSeconds(), errors);

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
    }

    /** The marks of the draft phase on the video: it starts, then locks, both before the game starts. */
    private static void marks(GameDraft draft, @Nullable Integer live, List<String> errors) {
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
    private static int turn(GameDraft draft, int index, @Nullable Integer live, Set<String> heroes,
            Map<Side, int[]> counts, int previous, List<String> errors) {
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
        if (turn.kind() == DraftKind.PICK && !Selections.present(turn.hero())) {
            errors.add(field + ".hero");
        }
        if (Selections.present(turn.hero())) {
            if (turn.hero().name() != null && turn.hero().name().length() > Selections.MAX_NAME) {
                errors.add(field + ".hero.name.length");
            }
            if (!heroes.add(Selections.identity(turn.hero()))) {
                errors.add(field + ".hero.duplicate");
            }
        }
        if (turn.side() != null && turn.kind() != null) {
            var count = counts.computeIfAbsent(turn.side(), ignored -> new int[2]);
            int kind = turn.kind() == DraftKind.BAN ? 0 : 1;
            if (++count[kind] > (kind == 0 ? GameRules.BANS_PER_SIDE : GameRules.PLAYERS_PER_SIDE)) {
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
                var ban = side.bans().get(index);
                if (Selections.present(ban) && !bans.contains(Selections.identity(ban))) {
                    errors.add(path + ".bans[" + index + "].notDrafted");
                }
            }
            for (int index = 0; index < side.participants().size(); index++) {
                var hero = side.participants().get(index).hero();
                if (Selections.present(hero) && !picks.contains(Selections.identity(hero))) {
                    errors.add(path + ".participants[" + index + "].hero.notDrafted");
                }
            }
        }
    }

    private static Set<String> drafted(GameDraft draft, @Nullable Side side, DraftKind kind) {
        var heroes = new HashSet<String>();
        for (var turn : draft.turns()) {
            if (turn.side() == side && turn.kind() == kind && Selections.present(turn.hero())) {
                heroes.add(Selections.identity(turn.hero()));
            }
        }
        return heroes;
    }
}
