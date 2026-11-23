package com.wikiaov.community.tournament.internal.planning.domain;

import com.wikiaov.community.tournament.internal.domain.MatchTitle;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record CompetitionPlan(
        String circuit,
        String organizer,
        UUID organizerPageId,
        String timezone,
        String prizePool,
        String currency,
        String sourceUrl,
        String notes,
        List<Venue> venues,
        List<Entry> entrants,
        List<Stage> stages,
        Map<Integer, UUID> playoffSeeds,
        List<Match> matches,
        UUID circuitPageId
) {
    public CompetitionPlan {
        timezone = timezone == null || timezone.isBlank() ? "Asia/Ho_Chi_Minh" : timezone;
        venues = venues == null ? List.of() : List.copyOf(venues);
        entrants = entrants == null ? List.of() : List.copyOf(entrants);
        stages = stages == null ? List.of() : List.copyOf(stages);
        playoffSeeds = playoffSeeds == null ? Map.of() : Map.copyOf(playoffSeeds);
        matches = matches == null ? List.of() : List.copyOf(matches);
    }

    public record Venue(
            String name,
            String city,
            String stageCode
    ) {
    }

    /** How a team takes part in the competition; absent when the sources do not say. */
    public enum EntryStatus {
        INVITED,
        QUALIFIED,
        REGISTERED,
        WITHDRAWN
    }

    public record Entry(
            UUID teamId,
            Integer seed,
            @Nullable EntryStatus status,
            String note
    ) {
        /** A team that withdrew keeps its entry but plays no match. */
        public boolean plays() {
            return status != EntryStatus.WITHDRAWN;
        }
    }

    public record Stage(
            String code,
            String name,
            String format,
            int bestOf,
            int legs,
            int winPoints,
            int lossPoints,
            int advance,
            List<String> tieBreakers,
            String sourceUrl,
            @Nullable DraftRule draftRule,
            @Nullable SideSelection sideSelection,
            @Nullable String rulesNote,
            List<PatchLine> patches
    ) {
        public Stage {
            tieBreakers = tieBreakers == null ? List.of("GAME_DIFF", "GAME_WINS") : List.copyOf(tieBreakers);
            patches = patches == null ? List.of() : List.copyOf(patches);
        }
    }

    /** How heroes may be picked again across the games of a series; absent when the sources do not say. */
    public enum DraftRule {
        /** A team may not pick a hero it already played in the series. */
        GLOBAL,
        /** A team may pick a hero again in a later game. */
        STANDARD
    }

    /** Who chooses the side of each game; absent when the sources do not say. */
    public enum SideSelection {
        /** The team listed first chooses in game one, then the loser of the previous game. */
        HOME_FIRST_THEN_LOSER,
        /** Described in the stage's rules note. */
        OTHER
    }

    /**
     * A game update used during a stage. {@code patchId} and {@code seasonId} point to the Wiki when it has them;
     * until then the publisher's patch notes ({@code sourceUrl}) and the release day stand for the update.
     * {@code seasonName} is kept so readers can show the season without asking the Wiki.
     */
    public record PatchLine(
            @Nullable String label,
            @Nullable LocalDate releasedOn,
            @Nullable String name,
            @Nullable UUID patchId,
            @Nullable UUID seasonId,
            @Nullable String seasonName,
            @Nullable String sourceUrl,
            @Nullable String note
    ) {
    }

    public record Slot(
            String type,
            UUID teamId,
            Integer seed,
            String matchKey,
            String label
    ) {
        public static Slot team(UUID id) {
            return new Slot("TEAM", id, null, null, null);
        }

        public static Slot seed(int seed) {
            return new Slot("SEED", null, seed, null, null);
        }

        public static Slot outcome(String key, boolean winner) {
            return new Slot(winner ? "WINNER" : "LOSER", null, null, key, null);
        }
    }

    /**
     * A planned match. {@code title} says what it is in its stage, as a code readers word in their language;
     * {@code label} is a name an editor typed, shown instead of the title when present. A renamed match keeps its
     * title.
     */
    public record Match(
            String key,
            String stageCode,
            int round,
            @Nullable String label,
            int bestOf,
            Instant scheduledAt,
            Slot a,
            Slot b,
            UUID seriesId,
            @Nullable MatchTitle title
    ) {
        public Match linked(UUID id) {
            return new Match(key, stageCode, round, label, bestOf, scheduledAt, a, b, id, title);
        }
    }

    public CompetitionPlan schedule(List<Match> value) {
        return new CompetitionPlan(circuit, organizer, organizerPageId, timezone, prizePool, currency, sourceUrl,
                notes, venues, entrants, stages, playoffSeeds, value, circuitPageId);
    }

    public CompetitionPlan organizedBy(String name) {
        return new CompetitionPlan(circuit, name, organizerPageId, timezone, prizePool, currency, sourceUrl,
                notes, venues, entrants, stages, playoffSeeds, matches, circuitPageId);
    }

    public CompetitionPlan inCircuit(String name) {
        return new CompetitionPlan(name, organizer, organizerPageId, timezone, prizePool, currency, sourceUrl,
                notes, venues, entrants, stages, playoffSeeds, matches, circuitPageId);
    }

    /** Whether a new series of this stage is played without the rule against picking a hero again. */
    public boolean repeatPicksAllowed(String stageCode) {
        return stages.stream()
                .anyMatch(stage -> stage.code().equals(stageCode) && stage.draftRule() == DraftRule.STANDARD);
    }

    public static CompetitionPlan empty() {
        return new CompetitionPlan("", "", null, null, "", "VND", "", "", null, null, null, null, null, null);
    }
}
