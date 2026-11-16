package com.wikiaov.hero.internal.application.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Responses for in-game ranking snapshots (ADR-025). */
public final class HeroRankingViews {
    private HeroRankingViews() {
    }

    /** A snapshot as listed, with how many of its values still wait for review. */
    public record Summary(
            UUID id,
            String code,
            String regionCode,
            String modeCode,
            String modeLabel,
            String periodLabel,
            Instant capturedAt,
            String sourceTimeZone,
            Instant confirmedAt,
            int heroCount,
            int valueCount,
            int needsReviewCount,
            long version
    ) {
    }

    public record Detail(
            UUID id,
            String code,
            String regionCode,
            String modeCode,
            String modeLabel,
            String periodLabel,
            Instant capturedAt,
            String sourceTimeZone,
            Instant confirmedAt,
            int heroCount,
            int valueCount,
            int needsReviewCount,
            long version,
            String sourceRun,
            String sourceNote,
            Instant createdAt,
            List<Image> images,
            List<HeroEntry> heroes
    ) {
    }

    public record Image(
            String imageId,
            String board,
            int pageNo,
            String fileName,
            int width,
            int height
    ) {
    }

    public record HeroEntry(
            UUID heroId,
            String heroCode,
            String nameOnScreen,
            String roleOnScreen,
            Integer ratesPosition,
            Integer figuresPosition,
            List<Value> values
    ) {
    }

    /** {@code heroId}/{@code heroCode} name the hero a counter value points at. */
    public record Value(
            String metric,
            BigDecimal number,
            String tier,
            UUID heroId,
            String heroCode,
            String readText,
            boolean needsReview,
            String note,
            Source source,
            Instant reviewedAt,
            long version
    ) {
    }

    public record Source(
            String imageId,
            int x,
            int y,
            int width,
            int height
    ) {
    }

    public record Reviewed(
            Value value,
            Summary snapshot
    ) {
    }

    /**
     * What readers see of one hero in the latest confirmed snapshot of a market and mode (ADR-029). Both parts are null
     * when no snapshot is confirmed; the entry is null when the snapshot lacks the hero.
     */
    public record Published(
            PublishedSnapshot snapshot,
            PublishedEntry entry
    ) {
    }

    public record PublishedSnapshot(
            String code,
            String regionCode,
            String modeCode,
            String modeLabel,
            String periodLabel,
            Instant capturedAt,
            String sourceTimeZone,
            int heroes
    ) {
    }

    /** Values still waiting for review are null and have no rank. */
    public record PublishedEntry(
            UUID heroId,
            String heroCode,
            String tier,
            BigDecimal winRate,
            BigDecimal pickRate,
            BigDecimal banRate,
            List<Figure> figures,
            List<Counter> counters
    ) {
    }

    /** A per-match figure and its rank among the snapshot's heroes that have it, highest first. */
    public record Figure(
            String metric,
            BigDecimal value,
            Integer rank,
            int of
    ) {
    }

    public record Counter(
            UUID heroId,
            String heroCode
    ) {
    }
}
