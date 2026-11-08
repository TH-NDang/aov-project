package com.wikiaov.gamemode.internal.lineup.persistence;

import java.util.UUID;

/** Total and recent likes of one lineup. */
public record LikeTotals(
        UUID lineupId,
        Long likes,
        Long recentLikes
) {
}
