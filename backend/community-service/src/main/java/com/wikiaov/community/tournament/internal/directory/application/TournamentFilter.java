package com.wikiaov.community.tournament.internal.directory.application;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * What a list of tournaments is narrowed and ordered by. An empty text leaves its filter out; {@code alsoRegions}
 * lists regions, comma separated, whose tournaments match whatever the search text. {@code teamId} and
 * {@code playerId} name the record in context, whose tournaments a picker shows first.
 */
public record TournamentFilter(
        String q,
        String alsoRegions,
        String status,
        String tier,
        String region,
        @Nullable Integer year,
        String sort,
        TournamentLevel level,
        @Nullable UUID teamId,
        @Nullable UUID playerId
) {
}
