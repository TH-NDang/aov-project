package com.wikiaov.community.tournament.internal.review.domain;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Text that names someone without a link. {@code recordId} is the game, series or tournament to open; {@code label} is
 * the match ("Team A vs Team B") or the award title; {@code text} is the name as the text writes it.
 */
public record Mention(
        MentionKind kind,
        UUID recordId,
        UUID tournamentId,
        String tournamentName,
        @Nullable UUID seriesId,
        @Nullable Integer gameNumber,
        @Nullable String label,
        String text
) {
    public record Count(
            MentionKind kind,
            long count
    ) {
    }
}
