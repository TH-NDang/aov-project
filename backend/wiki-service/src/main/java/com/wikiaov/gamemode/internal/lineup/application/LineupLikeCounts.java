package com.wikiaov.gamemode.internal.lineup.application;

import com.wikiaov.gamemode.internal.application.response.GameModeViews.LikeCount;
import com.wikiaov.gamemode.internal.lineup.persistence.LineupLikeRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Like totals and the 7-day trend window, shared by the guide page and the lineup lists. */
@Component
public class LineupLikeCounts {
    public static final Duration TREND_WINDOW = Duration.ofDays(7);

    private final LineupLikeRepository likes;

    private final Clock clock;

    public LineupLikeCounts(LineupLikeRepository likes, Clock clock) {
        this.likes = likes;
        this.clock = clock;
    }

    public Instant trendStart() {
        return clock.instant().minus(TREND_WINDOW);
    }

    /** Counts for every given lineup; lineups without likes get zero. */
    public Map<UUID, LikeCount> counts(UUID modeId, Collection<UUID> lineupIds) {
        var result = new HashMap<UUID, LikeCount>();
        lineupIds.forEach(id -> result.put(id, new LikeCount(0, 0)));
        if (lineupIds.isEmpty()) {
            return result;
        }
        likes.totals(modeId, trendStart(), lineupIds).forEach(row -> result.put(row.lineupId(),
                new LikeCount(row.likes(), row.recentLikes() == null ? 0 : row.recentLikes())));
        return result;
    }
}
