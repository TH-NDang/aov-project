package com.wikiaov.community.tournament.internal.planning.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Entry;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Slot;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Stage;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.ToIntFunction;

public final class CompetitionResults {
    private CompetitionResults() {
    }

    public record Resolved(
            String key,
            UUID teamAId,
            UUID teamBId,
            Integer scoreA,
            Integer scoreB,
            UUID seriesId,
            boolean consistent
    ) {
        public UUID winner() {
            return scoreA == null || !consistent ? null : scoreA > scoreB ? teamAId : teamBId;
        }

        public UUID loser() {
            return winner() == null ? null : winner().equals(teamAId) ? teamBId : teamAId;
        }
    }

    public record Standing(
            int rank,
            UUID teamId,
            int played,
            int won,
            int lost,
            int gameWins,
            int gameLosses,
            int points,
            boolean tied,
            boolean qualified
    ) {
    }

    public record Table(
            String stageCode,
            boolean complete,
            List<Standing> rows
    ) {
    }

    public static List<Resolved> resolve(CompetitionPlan plan, Map<UUID, Series> series) {
        var resolved = new LinkedHashMap<String, Resolved>();
        for (var match : plan.matches()) {
            UUID a = slot(match.a(), plan.playoffSeeds(), resolved);
            UUID b = slot(match.b(), plan.playoffSeeds(), resolved);
            Series recorded = match.seriesId() == null ? null : series.get(match.seriesId());
            boolean consistent = recorded == null
                    ? match.seriesId() == null
                    : Objects.equals(a, recorded.teamAId()) && Objects.equals(b, recorded.teamBId())
                            && match.bestOf() == recorded.bestOf();
            if (a != null && a.equals(b)) {
                consistent = false;
            }
            var result = recorded == null ? null : recorded.result();
            resolved.put(match.key(), new Resolved(match.key(), a, b, result == null ? null : result.scoreA(),
                    result == null ? null : result.scoreB(), match.seriesId(), consistent));
        }
        return List.copyOf(resolved.values());
    }

    private static UUID slot(Slot slot, Map<Integer, UUID> seeds, Map<String, Resolved> previous) {
        var before = previous.get(slot.matchKey());
        return switch (slot.type()) {
            case "TEAM" -> slot.teamId();
            case "SEED" -> seeds.get(slot.seed());
            case "WINNER" -> before == null ? null : before.winner();
            case "LOSER" -> before == null ? null : before.loser();
            default -> null;
        };
    }

    public static List<Table> tables(CompetitionPlan plan, List<Resolved> resolved) {
        var index = new HashMap<String, Resolved>();
        resolved.forEach(row -> index.put(row.key(), row));
        return plan.stages().stream().filter(stage -> stage.format().equals("ROUND_ROBIN"))
                .map(stage -> table(plan, stage, index)).toList();
    }

    private static Table table(CompetitionPlan plan, Stage stage, Map<String, Resolved> index) {
        var matches = plan.matches().stream().filter(match -> match.stageCode().equals(stage.code()))
                .map(match -> index.get(match.key())).toList();
        var stats = new LinkedHashMap<UUID, int[]>();
        plan.entrants().stream().filter(Entry::plays)
                .forEach(entry -> stats.put(entry.teamId(), new int[5]));
        for (var match : matches) {
            if (!match.consistent() || match.scoreA() == null || !stats.containsKey(match.teamAId())
                    || !stats.containsKey(match.teamBId())) {
                continue;
            }
            add(stats.get(match.teamAId()), match.scoreA(), match.scoreB(), stage);
            add(stats.get(match.teamBId()), match.scoreB(), match.scoreA(), stage);
        }
        int expected = stats.size() * (stats.size() - 1) / 2 * stage.legs();
        var pairs = new HashMap<Set<UUID>, Integer>();
        matches.stream().filter(
                match -> match.teamAId() != null && match.teamBId() != null && !match.teamAId().equals(match.teamBId()))
                .forEach(match -> pairs.merge(Set.of(match.teamAId(), match.teamBId()), 1, Integer::sum));
        boolean complete = expected > 0 && matches.size() == expected
                && pairs.size() == stats.size() * (stats.size() - 1) / 2
                && pairs.values().stream().allMatch(count -> count == stage.legs())
                && matches.stream().allMatch(match -> match.winner() != null);
        List<List<UUID>> groups = List.of(new ArrayList<>(stats.keySet()));
        groups = split(groups, team -> stats.get(team)[4]);
        for (String rule : stage.tieBreakers()) {
            if (rule.equals("HEAD_TO_HEAD")) {
                var refined = new ArrayList<List<UUID>>();
                for (var group : groups) {
                    var mini = new HashMap<UUID, Integer>();
                    group.forEach(team -> mini.put(team, 0));
                    int observed = 0;
                    for (var match : matches) {
                        if (!mini.containsKey(match.teamAId()) || !mini.containsKey(match.teamBId())
                                || match.winner() == null) {
                            continue;
                        }
                        observed++;
                        mini.compute(match.winner(), (key, value) -> value + stage.winPoints());
                        mini.compute(match.loser(), (key, value) -> value + stage.lossPoints());
                    }
                    if (observed == group.size() * (group.size() - 1) / 2 * stage.legs()) {
                        refined.addAll(split(List.of(group), mini::get));
                    } else {
                        refined.add(group);
                    }
                }
                groups = refined;
            } else if (rule.equals("GAME_DIFF")) {
                groups = split(groups, team -> stats.get(team)[2] - stats.get(team)[3]);
            } else if (rule.equals("GAME_WINS")) {
                groups = split(groups, team -> stats.get(team)[2]);
            }
        }
        var rows = new ArrayList<Standing>();
        for (var group : groups) {
            int rank = rows.size() + 1;
            boolean qualified = complete && rank + group.size() - 1 <= stage.advance();
            for (var team : group) {
                var values = stats.get(team);
                rows.add(new Standing(rank, team, values[0], values[1], values[0] - values[1], values[2], values[3],
                        values[4], group.size() > 1, qualified));
            }
        }
        return new Table(stage.code(), complete, List.copyOf(rows));
    }

    private static List<List<UUID>> split(List<List<UUID>> groups, ToIntFunction<UUID> value) {
        var result = new ArrayList<List<UUID>>();
        for (var group : groups) {
            var scores = new TreeMap<Integer, List<UUID>>(Comparator.reverseOrder());
            for (var team : group) {
                scores.computeIfAbsent(value.applyAsInt(team), key -> new ArrayList<>()).add(team);
            }
            result.addAll(scores.values());
        }
        return result;
    }

    private static void add(int[] stats, int own, int other, Stage stage) {
        stats[0]++;
        if (own > other) {
            stats[1]++;
        }
        stats[2] += own;
        stats[3] += other;
        stats[4] += own > other ? stage.winPoints() : stage.lossPoints();
    }
}
