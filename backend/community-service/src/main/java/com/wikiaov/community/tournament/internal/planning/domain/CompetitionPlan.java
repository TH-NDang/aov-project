package com.wikiaov.community.tournament.internal.planning.domain;

import java.time.Instant;
import java.util.*;

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
        List<Match> matches
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

    public record Entry(
            UUID teamId,
            Integer seed,
            String status,
            String note
    ) {
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
            String patchNote
    ) {
        public Stage {
            tieBreakers = tieBreakers == null ? List.of("GAME_DIFF", "GAME_WINS") : List.copyOf(tieBreakers);
        }
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

    public record Match(
            String key,
            String stageCode,
            int round,
            String label,
            int bestOf,
            Instant scheduledAt,
            Slot a,
            Slot b,
            UUID seriesId
    ) {
        public Match linked(UUID id) {
            return new Match(key, stageCode, round, label, bestOf, scheduledAt, a, b, id);
        }
    }

    public CompetitionPlan schedule(List<Match> value) {
        return new CompetitionPlan(circuit, organizer, organizerPageId, timezone, prizePool, currency, sourceUrl,
                notes, venues, entrants, stages, playoffSeeds, value);
    }

    public CompetitionPlan organizedBy(String name) {
        return new CompetitionPlan(circuit, name, organizerPageId, timezone, prizePool, currency, sourceUrl,
                notes, venues, entrants, stages, playoffSeeds, matches);
    }

    public static CompetitionPlan empty() {
        return new CompetitionPlan("", "", null, null, "", "VND", "", "", null, null, null, null, null);
    }
}
