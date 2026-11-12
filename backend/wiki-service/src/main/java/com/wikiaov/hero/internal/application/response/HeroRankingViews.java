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
}
