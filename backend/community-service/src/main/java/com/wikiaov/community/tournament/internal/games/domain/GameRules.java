package com.wikiaov.community.tournament.internal.games.domain;

import com.wikiaov.community.tournament.internal.domain.CatalogLocales;
import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Participant;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * What a recorded game must satisfy. The sides and their line-ups are checked here; loadouts, equipment, the timeline
 * and the draft have rule classes of their own. With {@code publication}, a violation is also what a public record
 * still lacks. Each violation names the offending field.
 */
public final class GameRules {
    public static final int MAX_GAME_NUMBER = 99;
    public static final int SIDES = 2;
    public static final int BANS_PER_SIDE = 4;
    public static final int PLAYERS_PER_SIDE = 5;

    private GameRules() {
    }

    public static List<String> violations(@Nullable Game game, boolean publication, @Nullable Catalog catalog) {
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
        TimelineRules.check(game.timeline(), game.durationSeconds(), errors);
        DraftRules.check(game, errors);
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

    private static void side(Game game, int sideIndex, boolean publication, @Nullable Catalog catalog, Seen seen,
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
            require(side.bans().size() == BANS_PER_SIDE, path + ".bans.four", errors);
            require(side.participants().size() == PLAYERS_PER_SIDE, path + ".participants.five", errors);
        }

        for (int banIndex = 0; banIndex < side.bans().size(); banIndex++) {
            var ban = side.bans().get(banIndex);
            String field = path + ".bans[" + banIndex + "]";
            Selections.check(ban, publication, field, errors, catalog == null ? null : catalog.heroes());
            if (Selections.present(ban) && !seen.bans().add(Selections.identity(ban))) {
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

    private static void participant(Participant participant, String field, @Nullable Integer duration,
            boolean publication, @Nullable Catalog catalog, Seen seen, List<String> errors) {
        if (publication) {
            require(participant.playerId() != null, field + ".playerId", errors);
            require(participant.lane() != null, field + ".lane", errors);
        }
        Selections.check(participant.hero(), publication, field + ".hero", errors,
                catalog == null ? null : catalog.heroes());
        Selections.check(participant.spell(), publication, field + ".spell", errors,
                catalog == null ? null : catalog.spells());
        if (Selections.present(participant.hero()) && !seen.heroes().add(Selections.identity(participant.hero()))) {
            errors.add(field + ".hero.duplicate");
        }
        LoadoutRules.arcana(participant.arcana(), field + ".arcana", publication, catalog, errors);
        LoadoutRules.enchantments(participant.enchantments(), field + ".enchantments", publication, catalog, errors);
        GameSeconds.observedAt(participant.spellObservedAtSeconds(), duration, field + ".spellObservedAtSeconds",
                errors);
        GameSeconds.observedAt(participant.arcana().observedAtSeconds(), duration, field + ".arcana.observedAtSeconds",
                errors);
        GameSeconds.observedAt(participant.enchantments().observedAtSeconds(), duration,
                field + ".enchantments.observedAtSeconds", errors);
        EquipmentRules.check(participant, field, publication, duration, catalog, errors);
    }

    private static void require(boolean valid, String path, List<String> errors) {
        if (!valid) {
            errors.add(path);
        }
    }
}
