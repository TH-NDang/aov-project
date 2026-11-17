package com.wikiaov.community.tournament.internal.planning.domain;

import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.*;
import java.time.ZoneId;
import java.util.*;

public final class CompetitionRules {
    public static final int MAX_ENTRANTS = 128;
    public static final int MAX_STAGES = 16;
    public static final int MAX_MATCHES = 2048;
    public static final int MAX_VENUES = 30;
    /** Highest seed an entrant or a seeded slot can hold. */
    public static final int MAX_SEED = 64;
    public static final Set<Integer> BEST_OF = Set.of(1, 2, 3, 4, 5, 7, 9);
    public static final Set<String> ENTRY_STATUSES = Set.of("INVITED", "QUALIFIED", "REGISTERED", "WITHDRAWN");

    private CompetitionRules() {
    }

    public static void validate(CompetitionPlan plan) {
        if (plan == null)
            throw new IllegalArgumentException("Competition plan is required.");
        ZoneId.of(plan.timezone());
        text(plan.circuit(), 300);
        text(plan.organizer(), 300);
        text(plan.prizePool(), 300);
        text(plan.currency(), 30);
        text(plan.sourceUrl(), 2000);
        text(plan.notes(), 20000);
        if (plan.venues().size() > MAX_VENUES)
            throw new IllegalArgumentException("Too many venues.");
        plan.venues().forEach(venue -> {
            text(venue.name(), 300);
            text(venue.city(), 200);
            text(venue.stageCode(), 100);
        });
        if (plan.entrants().size() > MAX_ENTRANTS || plan.stages().size() > MAX_STAGES
                || plan.matches().size() > MAX_MATCHES)
            throw new IllegalArgumentException("Competition plan exceeds its limits.");
        var teams = new HashSet<UUID>();
        for (var entrant : plan.entrants()) {
            text(entrant.note(), 2000);
            if (entrant.teamId() == null || !teams.add(entrant.teamId()))
                throw new IllegalArgumentException("Duplicate or missing entrant.");
            if (entrant.seed() != null && (entrant.seed() < 1 || entrant.seed() > MAX_SEED))
                throw new IllegalArgumentException("Invalid seed.");
            if (entrant.status() != null
                    && !ENTRY_STATUSES.contains(entrant.status()))
                throw new IllegalArgumentException("Invalid entry status.");
        }
        var stages = new HashSet<String>();
        for (var stage : plan.stages()) {
            if (stage.code() == null || !stage.code().matches("[A-Z0-9_]{2,60}") || !stages.add(stage.code()))
                throw new IllegalArgumentException("Invalid stage code.");
            if (stage.name() == null || stage.name().isBlank() || stage.name().length() > 200)
                throw new IllegalArgumentException("Stage name is required.");
            if (stage.format() == null || !Set.of("ROUND_ROBIN", "DOUBLE_ELIMINATION", "SINGLE_ELIMINATION", "CUSTOM")
                    .contains(stage.format()))
                throw new IllegalArgumentException("Unsupported format.");
            text(stage.sourceUrl(), 2000);
            text(stage.patchNote(), 2000);
            bestOf(stage.bestOf());
            if (stage.legs() < 1 || stage.legs() > 4 || stage.winPoints() < 0 || stage.lossPoints() < 0
                    || stage.advance() < 0 || stage.advance() > 64)
                throw new IllegalArgumentException("Invalid stage rules.");
            if (!Set.of("HEAD_TO_HEAD", "GAME_DIFF", "GAME_WINS").containsAll(stage.tieBreakers())
                    || new HashSet<>(stage.tieBreakers()).size() != stage.tieBreakers().size())
                throw new IllegalArgumentException("Invalid tiebreakers.");
        }
        var seeded = new HashSet<UUID>();
        plan.playoffSeeds().forEach((rank, team) -> {
            if (rank < 1 || rank > 64 || !teams.contains(team) || !seeded.add(team))
                throw new IllegalArgumentException("Invalid playoff seeding.");
        });
        var previous = new HashSet<String>();
        var series = new HashSet<UUID>();
        for (var match : plan.matches()) {
            text(match.label(), 300);
            if (match.key() == null || !match.key().matches("[A-Za-z0-9_-]{1,80}") || previous.contains(match.key()))
                throw new IllegalArgumentException("Duplicate or invalid match key.");
            if (!stages.contains(match.stageCode()) || match.round() < 1)
                throw new IllegalArgumentException("Match must belong to a stage and round.");
            bestOf(match.bestOf());
            slot(match.a(), teams, previous);
            slot(match.b(), teams, previous);
            if (Objects.equals(match.a(), match.b()))
                throw new IllegalArgumentException("A match needs different participant slots.");
            if (match.seriesId() != null && !series.add(match.seriesId()))
                throw new IllegalArgumentException("A series cannot belong to multiple matches.");
            previous.add(match.key());
        }
    }

    private static void bestOf(int value) {
        if (!BEST_OF.contains(value))
            throw new IllegalArgumentException("Use a best-of of 1, 2, 3, 4, 5, 7 or 9.");
    }

    private static void text(String value, int max) {
        if (value != null && value.length() > max)
            throw new IllegalArgumentException("Text exceeds its length limit.");
    }

    private static void slot(Slot slot, Set<UUID> teams, Set<String> previous) {
        if (slot == null || slot.type() == null)
            throw new IllegalArgumentException("Participant slot is required.");
        text(slot.label(), 200);
        boolean valid = switch (slot.type()) {
            case "TEAM" -> slot.teamId() != null && teams.contains(slot.teamId());
            case "SEED" -> slot.seed() != null && slot.seed() > 0 && slot.seed() <= MAX_SEED;
            case "WINNER", "LOSER" -> previous.contains(slot.matchKey());
            case "TBD" -> slot.label() != null && !slot.label().isBlank();
            default -> false;
        };
        if (!valid)
            throw new IllegalArgumentException("Invalid or cyclic participant slot.");
    }

    public static List<Match> roundRobin(Stage stage, List<Entry> entrants) {
        var rotation = new ArrayList<>(
                entrants.stream().filter(e -> !"WITHDRAWN".equals(e.status())).map(Entry::teamId).toList());
        if (rotation.size() < 2)
            throw new IllegalArgumentException("At least two entrants are required.");
        if (rotation.size() % 2 == 1)
            rotation.add(null);
        var matches = new ArrayList<Match>();
        int rounds = rotation.size() - 1;
        for (int leg = 0; leg < stage.legs(); leg++) {
            for (int round = 0; round < rounds; round++) {
                for (int pair = 0; pair < rotation.size() / 2; pair++) {
                    var left = rotation.get(pair);
                    var right = rotation.get(rotation.size() - 1 - pair);
                    if (left == null || right == null)
                        continue;
                    if ((leg + round + pair) % 2 == 1) {
                        var swap = left;
                        left = right;
                        right = swap;
                    }
                    int day = leg * rounds + round + 1;
                    matches.add(new Match(stage.code() + "_" + day + "_" + (pair + 1), stage.code(), day,
                            "Lượt " + (leg + 1) + " · Vòng " + (round + 1), stage.bestOf(), null, Slot.team(left),
                            Slot.team(right), null));
                }
                rotation.add(1, rotation.removeLast());
            }
        }
        return List.copyOf(matches);
    }

    public static List<Match> aogPlayoffs(Stage stage, int chosenOpponent) {
        if (chosenOpponent != 3 && chosenOpponent != 4)
            throw new IllegalArgumentException("Seed one must choose seed three or four.");
        String prefix = stage.code() + "_";
        return List.of(
                bracket(prefix + "US1", stage, 1, "Bán kết nhánh thắng 1", Slot.seed(1), Slot.seed(chosenOpponent)),
                bracket(prefix + "US2", stage, 1, "Bán kết nhánh thắng 2", Slot.seed(2),
                        Slot.seed(chosenOpponent == 3 ? 4 : 3)),
                bracket(prefix + "LQ1", stage, 2, "Vòng 1 nhánh thua · 1", Slot.seed(5),
                        Slot.outcome(prefix + "US1", false)),
                bracket(prefix + "LQ2", stage, 2, "Vòng 1 nhánh thua · 2", Slot.seed(6),
                        Slot.outcome(prefix + "US2", false)),
                bracket(prefix + "UF", stage, 2, "Chung kết nhánh thắng", Slot.outcome(prefix + "US1", true),
                        Slot.outcome(prefix + "US2", true)),
                bracket(prefix + "LS", stage, 3, "Bán kết nhánh thua", Slot.outcome(prefix + "LQ1", true),
                        Slot.outcome(prefix + "LQ2", true)),
                bracket(prefix + "LF", stage, 4, "Chung kết nhánh thua", Slot.outcome(prefix + "UF", false),
                        Slot.outcome(prefix + "LS", true)),
                bracket(prefix + "GF", stage, 5, "Chung kết tổng", Slot.outcome(prefix + "UF", true),
                        Slot.outcome(prefix + "LF", true)));
    }

    private static Match bracket(String key, Stage stage, int round, String label, Slot a, Slot b) {
        return new Match(key, stage.code(), round, label, stage.bestOf(), null, a, b, null);
    }
}
