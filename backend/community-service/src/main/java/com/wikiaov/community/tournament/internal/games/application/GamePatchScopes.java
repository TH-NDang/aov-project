package com.wikiaov.community.tournament.internal.games.application;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.games.persistence.GameRepository;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRecord;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRepository;
import com.wikiaov.community.tournament.internal.registry.persistence.SeriesRecord;
import com.wikiaov.community.tournament.internal.registry.persistence.SeriesRepository;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * The season and patch a game is played on (spec 04, patch ranges). A game that names its own season or patch keeps
 * it; otherwise the patch line of its match's stage in effect on the day it was played, in the competition's time
 * zone, stands for it. No game record is written: changing a line changes every game in its range.
 */
@Service
public class GamePatchScopes {
    private final GameRepository games;
    private final SeriesRepository series;
    private final CompetitionPlanRepository plans;

    public GamePatchScopes(GameRepository games, SeriesRepository series, CompetitionPlanRepository plans) {
        this.games = games;
        this.series = series;
        this.plans = plans;
    }

    /** Where a game's season and patch come from. */
    public enum Source {
        /** The game names its own season or patch, as an exception to its stage. */
        GAME,
        /** A patch line of the stage covers the day the game was played. */
        STAGE,
        /** No line covers the game: its stage has none, or the game was played before the first one. */
        NONE
    }

    /**
     * A game's scope. {@code patchId} is the Wiki patch a stage line names; {@code patchVariantId} the market's
     * release a game names itself. The catalog accepts either. The line's label, name and day say where it came from.
     */
    public record PatchScope(
            UUID gameId,
            Source source,
            @Nullable UUID seasonId,
            @Nullable UUID patchId,
            @Nullable UUID patchVariantId,
            @Nullable String stageCode,
            @Nullable LocalDate playedOn,
            @Nullable String lineLabel,
            @Nullable String lineName,
            @Nullable LocalDate lineReleasedOn
    ) {
        /** The patch to read the game's catalog in: the game's own release, or the Wiki patch of its line. */
        public @Nullable UUID catalogPatch() {
            return patchVariantId != null ? patchVariantId : patchId;
        }
    }

    /** The scope of every game of a tournament, in the order the games were played. */
    public List<PatchScope> forTournament(UUID tournamentId) {
        var plan = plans.findById(tournamentId).map(CompetitionPlanRecord::getContent).orElse(null);
        var page = games.search(null, tournamentId, "ACTIVE", Pageable.unpaged());
        var matches = series.findAllById(page.stream().map(row -> row.getContent().seriesId()).distinct().toList())
                .stream().collect(Collectors.toMap(SeriesRecord::getId, SeriesRecord::getContent));

        return page.stream()
                .map(row -> resolve(row.getId(), row.getContent(), matches.get(row.getContent().seriesId()), plan))
                .sorted(Comparator.comparing(PatchScope::playedOn, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    /** The scope of one game as it would be published now. */
    public PatchScope forGame(UUID gameId, Game content) {
        var match = content.seriesId() == null
                ? null
                : series.findById(content.seriesId()).map(
                        SeriesRecord::getContent).orElse(null);
        var plan = match == null || match.tournamentId() == null
                ? null
                : plans.findById(match.tournamentId()).map(CompetitionPlanRecord::getContent).orElse(null);
        return resolve(gameId, content, match, plan);
    }

    public static PatchScope resolve(UUID gameId, Game game, @Nullable Series match, @Nullable CompetitionPlan plan) {
        var stage = match == null ? null : match.stage();
        var day = playedOn(game, match, plan);

        if (game.seasonId() != null || game.patchVariantId() != null) {
            return new PatchScope(gameId, Source.GAME, game.seasonId(), null, game.patchVariantId(), stage, day, null,
                    null, null);
        }
        var line = plan == null || stage == null || day == null ? null : plan.patchLineAt(stage, day);
        if (line == null) {
            return new PatchScope(gameId, Source.NONE, null, null, null, stage, day, null, null, null);
        }
        return new PatchScope(gameId, Source.STAGE, line.seasonId(), line.patchId(), null, stage, day, line.label(),
                line.name(), line.releasedOn());
    }

    /** The day a game was played where the competition is held: its start, or its match's schedule. */
    private static @Nullable LocalDate playedOn(Game game, @Nullable Series match, @Nullable CompetitionPlan plan) {
        Instant at = game.startedAt() != null ? game.startedAt() : match == null ? null : match.scheduledAt();
        if (at == null) {
            return null;
        }

        try {
            return at.atZone(ZoneId.of(plan == null ? "Asia/Ho_Chi_Minh" : plan.timezone())).toLocalDate();
        } catch (DateTimeException invalid) {
            return at.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
        }
    }
}
