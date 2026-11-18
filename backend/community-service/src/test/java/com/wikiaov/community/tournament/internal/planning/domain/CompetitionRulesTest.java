package com.wikiaov.community.tournament.internal.planning.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.community.tournament.internal.domain.MatchTitle;
import com.wikiaov.community.tournament.internal.domain.MatchTitle.Kind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.SeriesResult;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Entry;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Match;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Slot;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Stage;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class CompetitionRulesTest {
    private Stage group(int legs, List<String> ties) {
        return new Stage("GROUP", "Group", "ROUND_ROBIN", 5, legs, 1, 0, 2, ties, "https://example.com", "");
    }

    private List<Entry> entrants(int count) {
        return IntStream.range(0, count)
                .mapToObj(i -> new Entry(UUID.randomUUID(), i + 1, "REGISTERED", "")).toList();
    }

    private CompetitionPlan plan(List<Entry> entrants, Stage stage, List<Match> matches) {
        return new CompetitionPlan("", "", null, null, "", "", "https://example.com", "", null, entrants,
                List.of(stage), null, matches, null);
    }

    @Test
    void nineTeamsPlayEveryOpponentTwiceWithOneByeAndBalancedSides() {
        var entries = entrants(9);
        var stage = group(2, List.of());
        var fixtures = CompetitionRules.roundRobin(stage, entries);
        CompetitionRules.validate(plan(entries, stage, fixtures));
        assertThat(fixtures).hasSize(72);
        var pairs = new HashMap<Set<UUID>, List<Match>>();
        var rounds = new HashMap<Integer, Set<UUID>>();
        for (var match : fixtures) {
            pairs.computeIfAbsent(Set.of(match.a().teamId(), match.b().teamId()), key -> new ArrayList<>()).add(match);
            var round = rounds.computeIfAbsent(match.round(), key -> new HashSet<>());
            assertThat(round.add(match.a().teamId())).isTrue();
            assertThat(round.add(match.b().teamId())).isTrue();
        }
        assertThat(pairs).hasSize(36);
        pairs.values().forEach(pair -> {
            assertThat(pair).hasSize(2);
            assertThat(pair.getFirst().a().teamId()).isEqualTo(pair.getLast().b().teamId());
        });
        assertThat(rounds).hasSize(18);
        assertThat(rounds.values()).allSatisfy(round -> assertThat(round).hasSize(8));
    }

    @Test
    void tiesAtQualificationBoundaryStayUnresolvedAndDoNotUseTeamNames() {
        var entries = entrants(3);
        var stage = group(1, List.of("HEAD_TO_HEAD", "GAME_DIFF", "GAME_WINS"));
        var fixtures = CompetitionRules.roundRobin(stage, entries);
        var resolved = new ArrayList<CompetitionResults.Resolved>();
        for (var fixture : fixtures) {
            int a = entries.stream().map(Entry::teamId).toList().indexOf(fixture.a().teamId());
            int b = entries.stream().map(Entry::teamId).toList().indexOf(fixture.b().teamId());
            boolean win = (a + 1) % 3 == b;
            resolved.add(new CompetitionResults.Resolved(fixture.key(), fixture.a().teamId(), fixture.b().teamId(),
                    win ? 3 : 1, win ? 1 : 3, null, true));
        }
        var table = CompetitionResults.tables(plan(entries, stage, fixtures), resolved).getFirst();
        assertThat(table.complete()).isTrue();
        assertThat(table.rows()).allSatisfy(row -> {
            assertThat(row.rank()).isOne();
            assertThat(row.tied()).isTrue();
            assertThat(row.qualified()).isFalse();
        });
    }

    @Test
    void bracketResolvesWinnerAndLoserSlotsWithoutInventingTeams() {
        var entries = entrants(6);
        var stage = new Stage("PO", "Playoffs", "DOUBLE_ELIMINATION", 7, 1, 1, 0, 1, List.of(), "", "");
        var fixtures = new ArrayList<>(CompetitionRules.aogPlayoffs(stage, 4));
        var seeds = new HashMap<Integer, UUID>();
        entries.forEach(entry -> seeds.put(entry.seed(), entry.teamId()));
        var id = UUID.randomUUID();
        fixtures.set(0, fixtures.getFirst().linked(id));
        var content = new CompetitionPlan("", "", null, null, "", "", "", "", null, entries, List.of(stage), seeds,
                fixtures, null);
        CompetitionRules.validate(content);
        var recorded = new Series("playoff", UUID.randomUUID(), "", "PO", seeds.get(1), seeds.get(4), 7, null, "", "",
                new SeriesResult(4, 2, "https://example.com", null, null));
        var result = CompetitionResults.resolve(content, Map.of(id, recorded));
        assertThat(result.get(2).teamBId()).isEqualTo(seeds.get(4));
        assertThat(result.get(4).teamAId()).isEqualTo(seeds.get(1));
        assertThat(result.getLast().teamAId()).isNull();
        seeds.put(1, entries.get(1).teamId());
        var changed = new CompetitionPlan("", "", null, null, "", "", "", "", null, entries, List.of(stage), seeds,
                fixtures, null);
        assertThat(CompetitionResults.resolve(changed, Map.of(id, recorded)).getFirst().consistent()).isFalse();
    }

    @Test
    void rejectsCyclicSlotsAndRepeatedEntrants() {
        var entries = entrants(2);
        var stage = group(1, List.of());
        var fixture = new Match("M1", "GROUP", 1, "", 5, null, Slot.outcome("M1", true),
                Slot.team(entries.getFirst().teamId()), null, null);
        assertThatThrownBy(() -> CompetitionRules.validate(plan(entries, stage, List.of(fixture))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CompetitionRules
                .validate(plan(List.of(entries.getFirst(), entries.getFirst()), stage, List.of())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void roundRobinFixturesCarryTheirLegAndRoundAsATitleWithoutAName() {
        var fixtures = CompetitionRules.roundRobin(group(2, List.of()), entrants(4));

        assertThat(fixtures).allSatisfy(match -> assertThat(match.label()).isNull());
        assertThat(fixtures.getFirst().title()).isEqualTo(MatchTitle.roundRobin(1, 1));
        assertThat(fixtures.getLast().title()).isEqualTo(MatchTitle.roundRobin(2, 3));
    }

    @Test
    void playoffFixturesCarryTheirBracketTitleWithoutAName() {
        var stage = new Stage("PO", "Playoffs", "DOUBLE_ELIMINATION", 7, 1, 1, 0, 1, List.of(), "", "");

        var titles = CompetitionRules.aogPlayoffs(stage, 3).stream().map(Match::title).toList();

        assertThat(titles).containsExactly(MatchTitle.numbered(Kind.UPPER_SEMIFINAL, null, 1),
                MatchTitle.numbered(Kind.UPPER_SEMIFINAL, null, 2), MatchTitle.numbered(Kind.LOWER_ROUND, 1, 1),
                MatchTitle.numbered(Kind.LOWER_ROUND, 1, 2), MatchTitle.of(Kind.UPPER_FINAL),
                MatchTitle.of(Kind.LOWER_SEMIFINAL), MatchTitle.of(Kind.LOWER_FINAL), MatchTitle.of(Kind.GRAND_FINAL));
    }

    @Test
    void aTitleNeedsAKindAndNumbersFromOneToNinetyNine() {
        assertThat(MatchTitle.valid(null)).isTrue();
        assertThat(MatchTitle.valid(MatchTitle.roundRobin(1, 99))).isTrue();
        assertThat(MatchTitle.valid(new MatchTitle(null, 1, 1, null))).isFalse();
        assertThat(MatchTitle.valid(MatchTitle.roundRobin(1, 100))).isFalse();
        assertThat(MatchTitle.valid(MatchTitle.numbered(Kind.LOWER_ROUND, 0, 1))).isFalse();
    }
}
