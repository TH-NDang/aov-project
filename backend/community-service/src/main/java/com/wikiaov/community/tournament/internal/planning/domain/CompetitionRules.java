package com.wikiaov.community.tournament.internal.planning.domain;

import com.wikiaov.community.tournament.internal.domain.MatchTitle;
import com.wikiaov.community.tournament.internal.domain.MatchTitle.Kind;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Entry;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Match;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Slot;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Stage;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public final class CompetitionRules {
    public static final int MAX_ENTRANTS = 128;
    public static final int MAX_STAGES = 16;
    public static final int MAX_MATCHES = 2048;
    public static final int MAX_VENUES = 30;
    /** Highest seed an entrant or a seeded slot can hold. */
    public static final int MAX_SEED = 64;
    public static final Set<Integer> BEST_OF = Set.of(1, 2, 3, 4, 5, 7, 9);
    public static final int MAX_LEGS = 4;
    /** Teams the AOG playoff template seeds. */
    public static final int AOG_PLAYOFF_TEAMS = 6;
    /** Most teams a stage sends on, and the highest rank of a playoff seeding. */
    public static final int MAX_ADVANCE = 64;
    /** Names of the plan, its organizer, prize pool, venues and matches. */
    public static final int MAX_NAME = 300;
    /** Names of stages, cities and slots. */
    public static final int MAX_LABEL = 200;
    /** Stage codes of a venue. */
    public static final int MAX_CODE = 100;
    public static final int MAX_CURRENCY = 30;
    /** Links and short notes: a source, a stage rules note, an entrant note. */
    public static final int MAX_TEXT = 2000;
    /** Game updates listed for one stage. */
    public static final int MAX_PATCHES = 30;
    public static final int MAX_NOTES = 20_000;
    public static final Set<String> FORMATS = Set.of("ROUND_ROBIN", "DOUBLE_ELIMINATION", "SINGLE_ELIMINATION",
            "CUSTOM");
    public static final Set<String> TIE_BREAKERS = Set.of("HEAD_TO_HEAD", "GAME_DIFF", "GAME_WINS");

    private CompetitionRules() {
    }

    public static void validate(CompetitionPlan plan) {
        if (plan == null) {
            throw new IllegalArgumentException("Competition plan is required.");
        }
        ZoneId.of(plan.timezone());
        planText(plan);
        if (plan.entrants().size() > MAX_ENTRANTS || plan.stages().size() > MAX_STAGES
                || plan.matches().size() > MAX_MATCHES) {
            throw new IllegalArgumentException("Competition plan exceeds its limits.");
        }

        var teams = entrants(plan);
        var stages = stages(plan);
        seeds(plan, teams);
        matches(plan, teams, stages);
    }

    private static void planText(CompetitionPlan plan) {
        text(plan.circuit(), MAX_NAME);
        text(plan.organizer(), MAX_NAME);
        text(plan.prizePool(), MAX_NAME);
        text(plan.currency(), MAX_CURRENCY);
        text(plan.sourceUrl(), MAX_TEXT);
        text(plan.notes(), MAX_NOTES);
        if (plan.venues().size() > MAX_VENUES) {
            throw new IllegalArgumentException("Too many venues.");
        }
        plan.venues().forEach(venue -> {
            text(venue.name(), MAX_NAME);
            text(venue.city(), MAX_LABEL);
            text(venue.stageCode(), MAX_CODE);
        });
    }

    /** Checks the entrants and returns their teams. */
    private static Set<UUID> entrants(CompetitionPlan plan) {
        var teams = new HashSet<UUID>();
        for (var entrant : plan.entrants()) {
            text(entrant.note(), MAX_TEXT);
            if (entrant.teamId() == null || !teams.add(entrant.teamId())) {
                throw new IllegalArgumentException("Duplicate or missing entrant.");
            }
            if (entrant.seed() != null && (entrant.seed() < 1 || entrant.seed() > MAX_SEED)) {
                throw new IllegalArgumentException("Invalid seed.");
            }
        }
        return teams;
    }

    /** Checks the stages and returns their codes. */
    private static Set<String> stages(CompetitionPlan plan) {
        var stages = new HashSet<String>();
        for (var stage : plan.stages()) {
            if (stage.code() == null || !stage.code().matches("[A-Z0-9_]{2,60}") || !stages.add(stage.code())) {
                throw new IllegalArgumentException("Invalid stage code.");
            }
            if (stage.name() == null || stage.name().isBlank() || stage.name().length() > MAX_LABEL) {
                throw new IllegalArgumentException("Stage name is required.");
            }
            if (stage.format() == null || !FORMATS.contains(stage.format())) {
                throw new IllegalArgumentException("Unsupported format.");
            }
            text(stage.sourceUrl(), MAX_TEXT);
            text(stage.rulesNote(), MAX_TEXT);
            patches(stage);
            bestOf(stage.bestOf());
            if (stage.legs() < 1 || stage.legs() > MAX_LEGS || stage.winPoints() < 0 || stage.lossPoints() < 0
                    || stage.advance() < 0 || stage.advance() > MAX_ADVANCE) {
                throw new IllegalArgumentException("Invalid stage rules.");
            }
            if (!TIE_BREAKERS.containsAll(stage.tieBreakers())
                    || new HashSet<>(stage.tieBreakers()).size() != stage.tieBreakers().size()) {
                throw new IllegalArgumentException("Invalid tiebreakers.");
            }
        }
        return stages;
    }

    /** Each patch line names an update by a Wiki patch, a release day or the publisher's patch notes. */
    private static void patches(Stage stage) {
        if (stage.patches().size() > MAX_PATCHES) {
            throw new IllegalArgumentException("Too many patches in a stage.");
        }
        for (var line : stage.patches()) {
            if (line == null || line.patchId() == null && line.releasedOn() == null && blank(line.sourceUrl())) {
                throw new IllegalArgumentException("A stage patch needs a Wiki patch, a release day or a source.");
            }
            text(line.label(), MAX_LABEL);
            text(line.name(), MAX_NAME);
            text(line.seasonName(), MAX_LABEL);
            text(line.sourceUrl(), MAX_TEXT);
            text(line.note(), MAX_TEXT);
        }
    }

    private static boolean blank(@Nullable String value) {
        return value == null || value.isBlank();
    }

    private static void seeds(CompetitionPlan plan, Set<UUID> teams) {
        var seeded = new HashSet<UUID>();
        plan.playoffSeeds().forEach((rank, team) -> {
            if (rank < 1 || rank > MAX_ADVANCE || !teams.contains(team) || !seeded.add(team)) {
                throw new IllegalArgumentException("Invalid playoff seeding.");
            }
        });
    }

    /** A match belongs to a stage and may only wait for the outcome of a match listed before it. */
    private static void matches(CompetitionPlan plan, Set<UUID> teams, Set<String> stages) {
        var previous = new HashSet<String>();
        var series = new HashSet<UUID>();
        for (var match : plan.matches()) {
            text(match.label(), MAX_NAME);
            if (!MatchTitle.valid(match.title())) {
                throw new IllegalArgumentException("A match title needs a kind and numbers from 1 to "
                        + MatchTitle.MAX_NUMBER + ".");
            }
            if (match.key() == null || !match.key().matches("[A-Za-z0-9_-]{1,80}") || previous.contains(match.key())) {
                throw new IllegalArgumentException("Duplicate or invalid match key.");
            }
            if (!stages.contains(match.stageCode()) || match.round() < 1) {
                throw new IllegalArgumentException("Match must belong to a stage and round.");
            }
            bestOf(match.bestOf());
            slot(match.a(), teams, previous);
            slot(match.b(), teams, previous);
            // Two open slots are still two sides; any other slot may not face itself.
            if (!"TBD".equals(match.a().type()) && Objects.equals(match.a(), match.b())) {
                throw new IllegalArgumentException("A match needs different participant slots.");
            }
            if (match.seriesId() != null && !series.add(match.seriesId())) {
                throw new IllegalArgumentException("A series cannot belong to multiple matches.");
            }
            previous.add(match.key());
        }
    }

    private static void bestOf(int value) {
        if (!BEST_OF.contains(value)) {
            throw new IllegalArgumentException("Use a best-of of 1, 2, 3, 4, 5, 7 or 9.");
        }
    }

    private static void text(String value, int max) {
        if (value != null && value.length() > max) {
            throw new IllegalArgumentException("Text exceeds its length limit.");
        }
    }

    private static void slot(Slot slot, Set<UUID> teams, Set<String> previous) {
        if (slot == null || slot.type() == null) {
            throw new IllegalArgumentException("Participant slot is required.");
        }
        text(slot.label(), MAX_LABEL);
        boolean valid = switch (slot.type()) {
            case "TEAM" -> slot.teamId() != null && teams.contains(slot.teamId());
            case "SEED" -> slot.seed() != null && slot.seed() > 0 && slot.seed() <= MAX_SEED;
            case "WINNER", "LOSER" -> previous.contains(slot.matchKey());
            // An open slot may carry the editor's description; without one, readers word it as undecided.
            case "TBD" -> true;
            default -> false;
        };
        if (!valid) {
            throw new IllegalArgumentException("Invalid or cyclic participant slot.");
        }
    }

    public static List<Match> roundRobin(Stage stage, List<Entry> entrants) {
        var rotation = new ArrayList<>(
                entrants.stream().filter(Entry::plays).map(Entry::teamId).toList());
        if (rotation.size() < 2) {
            throw new IllegalArgumentException("At least two entrants are required.");
        }
        if (rotation.size() % 2 == 1) {
            rotation.add(null);
        }
        var matches = new ArrayList<Match>();
        int rounds = rotation.size() - 1;
        for (int leg = 0; leg < stage.legs(); leg++) {
            for (int round = 0; round < rounds; round++) {
                for (int pair = 0; pair < rotation.size() / 2; pair++) {
                    var left = rotation.get(pair);
                    var right = rotation.get(rotation.size() - 1 - pair);
                    if (left == null || right == null) {
                        continue;
                    }
                    if ((leg + round + pair) % 2 == 1) {
                        var swap = left;
                        left = right;
                        right = swap;
                    }
                    int day = leg * rounds + round + 1;
                    matches.add(new Match(stage.code() + "_" + day + "_" + (pair + 1), stage.code(), day, null,
                            stage.bestOf(), null, Slot.team(left), Slot.team(right), null,
                            MatchTitle.roundRobin(leg + 1, round + 1)));
                }
                rotation.add(1, rotation.removeLast());
            }
        }
        return List.copyOf(matches);
    }

    public static List<Match> aogPlayoffs(Stage stage, int chosenOpponent) {
        if (chosenOpponent != 3 && chosenOpponent != 4) {
            throw new IllegalArgumentException("Seed one must choose seed three or four.");
        }
        String prefix = stage.code() + "_";
        return List.of(
                bracket(prefix + "US1", stage, 1, MatchTitle.numbered(Kind.UPPER_SEMIFINAL, null, 1), Slot.seed(1),
                        Slot.seed(chosenOpponent)),
                bracket(prefix + "US2", stage, 1, MatchTitle.numbered(Kind.UPPER_SEMIFINAL, null, 2), Slot.seed(2),
                        Slot.seed(chosenOpponent == 3 ? 4 : 3)),
                bracket(prefix + "LQ1", stage, 2, MatchTitle.numbered(Kind.LOWER_ROUND, 1, 1), Slot.seed(5),
                        Slot.outcome(prefix + "US1", false)),
                bracket(prefix + "LQ2", stage, 2, MatchTitle.numbered(Kind.LOWER_ROUND, 1, 2), Slot.seed(6),
                        Slot.outcome(prefix + "US2", false)),
                bracket(prefix + "UF", stage, 2, MatchTitle.of(Kind.UPPER_FINAL), Slot.outcome(prefix + "US1", true),
                        Slot.outcome(prefix + "US2", true)),
                bracket(prefix + "LS", stage, 3, MatchTitle.of(Kind.LOWER_SEMIFINAL),
                        Slot.outcome(prefix + "LQ1", true),
                        Slot.outcome(prefix + "LQ2", true)),
                bracket(prefix + "LF", stage, 4, MatchTitle.of(Kind.LOWER_FINAL), Slot.outcome(prefix + "UF", false),
                        Slot.outcome(prefix + "LS", true)),
                bracket(prefix + "GF", stage, 5, MatchTitle.of(Kind.GRAND_FINAL), Slot.outcome(prefix + "UF", true),
                        Slot.outcome(prefix + "LF", true)));
    }

    /** A generated match carries a title and no name, so each reader words it in its own language. */
    private static Match bracket(String key, Stage stage, int round, MatchTitle title, Slot a, Slot b) {
        return new Match(key, stage.code(), round, null, stage.bestOf(), null, a, b, null, title);
    }
}
