package com.wikiaov.hero.internal.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Requests for in-game ranking snapshots (ADR-025). */
public final class HeroRankingCommands {
    private HeroRankingCommands() {
    }

    /** A whole snapshot as written by the screenshot reader; heroes are named by code. */
    public record ImportSnapshot(
            @NotBlank @Size(max = 120) String code,
            @NotBlank @Size(max = 16) String regionCode,
            @NotBlank @Size(max = 32) String modeCode,
            @NotBlank @Size(max = 120) String modeLabel,
            @Size(max = 120) String periodLabel,
            @NotNull Instant capturedAt,
            @NotBlank @Size(max = 64) String sourceTimeZone,
            @NotBlank @Size(max = 200) String sourceRun,
            @Size(max = 2000) String sourceNote,
            @NotNull @Size(max = 400) List<@Valid @NotNull Image> images,
            @NotNull @Size(min = 1, max = 400) List<@Valid @NotNull Hero> heroes
    ) {
    }

    public record Image(
            @NotBlank @Size(max = 64) String imageId,
            @NotBlank @Size(max = 16) String board,
            @Positive int pageNo,
            @NotBlank @Size(max = 255) String fileName,
            @Positive int width,
            @Positive int height
    ) {
    }

    public record Hero(
            @NotBlank @Size(max = 64) String heroCode,
            @NotBlank @Size(max = 120) String nameOnScreen,
            @NotBlank @Size(max = 16) String roleOnScreen,
            @Positive Integer ratesPosition,
            @Positive Integer figuresPosition,
            @NotNull @Size(max = 12) List<@Valid @NotNull Value> values
    ) {
    }

    public record Value(
            @NotBlank @Size(max = 16) String metric,
            BigDecimal number,
            @Size(max = 8) String tier,
            @Size(max = 64) String heroCode,
            @Size(max = 40) String readText,
            boolean needsReview,
            @Size(max = 1000) String note,
            @Valid Source source
    ) {
    }

    public record Source(
            @NotBlank @Size(max = 64) String imageId,
            @PositiveOrZero int x,
            @PositiveOrZero int y,
            @Positive int width,
            @Positive int height
    ) {
    }

    /**
     * Confirms, corrects or flags one value. The value fields follow the metric's kind; leaving them all empty records a
     * gap, which must stay in review.
     */
    public record ReviewValue(
            @Positive long expectedVersion,
            BigDecimal number,
            @Size(max = 8) String tier,
            UUID heroId,
            @NotNull Boolean needsReview,
            @Size(max = 1000) String note
    ) {
    }

    public record ConfirmSnapshot(
            @Positive long expectedVersion
    ) {
    }
}
