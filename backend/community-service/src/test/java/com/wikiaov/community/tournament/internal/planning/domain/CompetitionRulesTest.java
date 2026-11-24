package com.wikiaov.community.tournament.internal.planning.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.community.tournament.internal.domain.MatchTitle;
import com.wikiaov.community.tournament.internal.domain.MatchTitle.Kind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.SeriesResult;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.DraftRule;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Entry;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.EntryStatus;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Match;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.PatchLine;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Slot;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Stage;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

class CompetitionRulesTest {
    private Stage group(int legs, List<String> ties) {
        return new Stage("GROUP", "Group", "ROUND_ROBIN", 5, legs, 1, 0, 2, ties, "https://example.com", null, null,
                null, null, null);
    }

    private Stage ruled(@Nullable DraftRule draftRule, List<PatchLine> patches) {
        return new Stage("GROUP", "Group", "ROUND_ROBIN", 5, 1, 1, 0, 2, List.of(), "https://example.com", draftRule,
                null, null, patches, null);
    }

    private List<Entry> entrants(int count) {
        return IntStream.range(0, count)
                .mapToObj(i -> new Entry(UUID.randomUUID(), i + 1, EntryStatus.REGISTERED, "")).toList();
    }

    private CompetitionPlan plan(List<Entry> entrants, Stage stage, List<Match> matches) {
        return new CompetitionPlan("", "", null, null, "", "", "https://example.com", "", null, entrants,
                List.of(stage), null, matches, null);
    }

    @Test
    void aPatchLineNeedsAWikiPatchAReleaseDayOrASource() {
        var entries = entrants(2);
        var bare = new PatchLine("Week 1", null, "Patch", null, null, "S4 2026", " ", null);
        var dated = new PatchLine("Week 1", LocalDate.of(2026, 8, 13), null, null, null, null, null, null);
        var linked = new PatchLine(null, null, null, UUID.randomUUID(), null, null, null, null);

        assertThatThrownBy(() -> CompetitionRules.validate(plan(entries, ruled(null, List.of(bare)), List.of())))
                .isInstanceOf(IllegalArgumentException.class);
        CompetitionRules.validate(plan(entries, ruled(null, List.of(dated, linked)), List.of()));
    }

    @Test
    void onlyAStandardDraftLetsNewSeriesPickAHeroAgain() {
        var entries = entrants(2);

        assertThat(plan(entries, ruled(DraftRule.STANDARD, List.of()), List.of()).repeatPicksAllowed("GROUP"))
                .isTrue();
        assertThat(plan(entries, ruled(DraftRule.GLOBAL, List.of()), List.of()).repeatPicksAllowed("GROUP"))
                .isFalse();
        assertThat(plan(entries, ruled(null, List.of()), List.of()).repeatPicksAllowed("GROUP")).isFalse();
        assertThat(plan(entries, ruled(DraftRule.STANDARD, List.of()), List.of()).repeatPicksAllowed("OTHER"))
                .isFalse();
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
    void aPatchLineHoldsFromItsReleaseDayUntilTheNextLineOfTheStage() {
        var first = new PatchLine("Week 1", LocalDate.of(2026, 8, 13), null, null, null, null, null, null);
        var second = new PatchLine("Week 2-4", LocalDate.of(2026, 8, 27), null, UUID.randomUUID(), null, null, null,
                null);
        var content = plan(entrants(2), ruled(null, List.of(second, first)), List.of());

        assertThat(content.patchLineAt("GROUP", LocalDate.of(2026, 8, 13))).isEqualTo(first);
        assertThat(content.patchLineAt("GROUP", LocalDate.of(2026, 8, 26))).isEqualTo(first);
        assertThat(content.patchLineAt("GROUP", LocalDate.of(2026, 8, 27))).isEqualTo(second);
        assertThat(content.patchLineAt("GROUP", LocalDate.of(2026, 10, 1))).isEqualTo(second);
    }

    @Test
    void aDayBeforeTheFirstLineOrAnUnknownStageHasNoPatchLine() {
        var first = new PatchLine("Week 1", LocalDate.of(2026, 8, 13), null, null, null, null, null, null);
        var content = plan(entrants(2), ruled(null, List.of(first)), List.of());

        assertThat(content.patchLineAt("GROUP", LocalDate.of(2026, 8, 12))).isNull();
        assertThat(content.patchLineAt("PLAYOFFS", LocalDate.of(2026, 8, 20))).isNull();
    }

    @Test
    void aSingleUndatedLineCoversTheWholeStage() {
        var only = new PatchLine("Playoffs", null, null, UUID.randomUUID(), null, null, null, null);
        var content = plan(entrants(2), ruled(null, List.of(only)), List.of());

        assertThat(content.patchLineAt("GROUP", LocalDate.of(2020, 1, 1))).isEqualTo(only);
    }

    @Test
    void bracketResolvesWinnerAndLoserSlotsWithoutInventingTeams() {
        var entries = entrants(6);
        var stage = new Stage("PO", "Playoffs", "DOUBLE_ELIMINATION", 7, 1, 1, 0, 1, List.of(), "", null, null, null,
                null, null);
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
        var stage = new Stage("PO", "Playoffs", "DOUBLE_ELIMINATION", 7, 1, 1, 0, 1, List.of(), "", null, null, null,
                null, null);

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

    @Test
    void aMatchBetweenTwoOpenSlotsNeedsNoNamesSoReadersCanWordThem() {
        var entries = entrants(2);
        var stage = group(1, List.of());
        var open = new Slot("TBD", null, null, null, null);
        var match = new Match("M1", "GROUP", 1, null, 5, null, open, open, null, MatchTitle.of(Kind.EXTRA));

        CompetitionRules.validate(plan(entries, stage, List.of(match)));
    }

    @Test
    void aStageWithItsOwnTeamsRanksOnlyThem() {
        var entries = entrants(4);
        var teamIds = entries.stream().limit(2).map(Entry::teamId).toList();
        var stage = groupOf(teamIds);
        var content = new CompetitionPlan("", "", null, null, "", "", "", "", null, entries, List.of(stage), null,
                CompetitionRules.roundRobin(stage, entries), null);

        CompetitionRules.validate(content);
        var table = CompetitionResults.tables(content, CompetitionResults.resolve(content, Map.of())).getFirst();

        assertThat(content.matches()).hasSize(1);
        assertThat(table.rows()).extracting(CompetitionResults.Standing::teamId)
                .containsExactlyInAnyOrderElementsOf(teamIds);
    }

    @Test
    void aStageMayNotNameATeamThatIsNoEntrant() {
        var stage = groupOf(List.of(UUID.randomUUID()));
        var content = new CompetitionPlan("", "", null, null, "", "", "", "", null, entrants(4), List.of(stage), null,
                null, null);

        assertThatThrownBy(() -> CompetitionRules.validate(content)).isInstanceOf(IllegalArgumentException.class);
    }

    private Stage groupOf(List<UUID> teamIds) {
        return new Stage("GROUP", "Group A", "ROUND_ROBIN", 3, 1, 1, 0, 1, List.of(), "", null, null, null, null,
                teamIds);
    }
}
