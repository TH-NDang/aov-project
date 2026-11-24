package com.wikiaov.community.tournament.internal.games.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.games.application.GamePatchScopes.Source;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.PatchLine;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Stage;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GamePatchScopesTest {
    private static final UUID SEASON = UUID.randomUUID();
    private static final UUID PATCH = UUID.randomUUID();
    private static final PatchLine WEEK_ONE = new PatchLine("Week 1", LocalDate.of(2026, 8, 13), "Patch", PATCH,
            SEASON, "S3 2026", null, null);

    private static CompetitionPlan plan() {
        var stage = new Stage("GROUP", "Group", "ROUND_ROBIN", 5, 1, 1, 0, 2, List.of(), "", null, null, null,
                List.of(WEEK_ONE));
        return new CompetitionPlan("", "", null, "Asia/Ho_Chi_Minh", "", "", "", "", null, null, List.of(stage), null,
                null, null);
    }

    private static Series match(Instant scheduledAt) {
        return new Series("m", UUID.randomUUID(), "", "GROUP", UUID.randomUUID(), UUID.randomUUID(), 5, scheduledAt,
                "", "", null, false, null);
    }

    private static Game game(Instant startedAt, UUID seasonId, UUID patchVariantId) {
        return new Game(UUID.randomUUID(), 1, "VN", "vi-VN", seasonId, patchVariantId, startedAt, null, null, null,
                null, null, List.of(), false, null, null, null);
    }

    @Test
    void aGameWithoutAPatchOfItsOwnIsPlayedOnTheLineOfItsStage() {
        var scope = GamePatchScopes.resolve(UUID.randomUUID(), game(Instant.parse("2026-08-13T10:00:00Z"), null, null),
                match(null), plan());

        assertThat(scope.source()).isEqualTo(Source.STAGE);
        assertThat(scope.patchId()).isEqualTo(PATCH);
        assertThat(scope.seasonId()).isEqualTo(SEASON);
        assertThat(scope.catalogPatch()).isEqualTo(PATCH);
        assertThat(scope.lineLabel()).isEqualTo("Week 1");
    }

    @Test
    void theDayIsReadWhereTheCompetitionIsPlayed() {
        // 17:30 UTC on 12 August is already 13 August in Hanoi.
        var scope = GamePatchScopes.resolve(UUID.randomUUID(), game(Instant.parse("2026-08-12T17:30:00Z"), null, null),
                match(null), plan());

        assertThat(scope.playedOn()).isEqualTo(LocalDate.of(2026, 8, 13));
        assertThat(scope.source()).isEqualTo(Source.STAGE);
    }

    @Test
    void aGameWithoutAStartTakesTheScheduleOfItsMatch() {
        var scope = GamePatchScopes.resolve(UUID.randomUUID(), game(null, null, null),
                match(Instant.parse("2026-08-20T10:00:00Z")), plan());

        assertThat(scope.source()).isEqualTo(Source.STAGE);
    }

    @Test
    void aPatchTheGameNamesItselfWinsOverItsStage() {
        var own = UUID.randomUUID();
        var scope = GamePatchScopes.resolve(UUID.randomUUID(), game(Instant.parse("2026-08-20T10:00:00Z"), null, own),
                match(null), plan());

        assertThat(scope.source()).isEqualTo(Source.GAME);
        assertThat(scope.catalogPatch()).isEqualTo(own);
    }

    @Test
    void aGamePlayedBeforeTheFirstLineHasNoPatch() {
        var scope = GamePatchScopes.resolve(UUID.randomUUID(), game(Instant.parse("2026-08-01T10:00:00Z"), null, null),
                match(null), plan());

        assertThat(scope.source()).isEqualTo(Source.NONE);
        assertThat(scope.catalogPatch()).isNull();
    }
}
