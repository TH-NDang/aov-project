package com.wikiaov.build.internal.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Requests for recommended builds read from the game (ADR-026). */
public final class BuildCommands {
    private BuildCommands() {
    }

    /** A whole capture as written by the screenshot reader; every reference is named by code. */
    public record ImportCapture(
            @NotBlank @Size(max = 120) String code,
            @NotBlank @Size(max = 16) String regionCode,
            @NotBlank @Size(max = 16) String sourceKind,
            @NotBlank @Size(max = 120) String sourceLabel,
            @NotNull Instant capturedAt,
            @NotBlank @Size(max = 64) String sourceTimeZone,
            @NotBlank @Size(max = 200) String sourceRun,
            @Size(max = 2000) String sourceNote,
            @NotNull @Size(max = 2000) List<@Valid @NotNull Image> images,
            @NotNull @Size(min = 1, max = 400) List<@Valid @NotNull Hero> heroes
    ) {
    }

    public record Image(
            @NotBlank @Size(max = 64) String imageId,
            @NotBlank @Size(max = 255) String fileName,
            @Positive int width,
            @Positive int height,
            @NotBlank @Size(max = 32) String layout
    ) {
    }

    public record Hero(
            @NotBlank @Size(max = 64) String heroCode,
            @NotBlank @Size(max = 120) String nameOnScreen,
            @Positive int captureOrder,
            @NotBlank @Size(max = 16) String result,
            @NotNull @Size(max = 50) List<@Valid @NotNull ImportedBuild> builds
    ) {
    }

    public record ImportedBuild(
            @Min(1) @Max(50) int position,
            @Size(max = 64) String imageId,
            @NotNull @Size(max = 6) List<@Valid @NotNull ItemCode> items,
            @NotNull @Size(max = 5) List<@Valid @NotNull EnchantmentCode> enchantments,
            @NotNull @Size(max = 30) List<@Valid @NotNull ArcanaCode> arcana,
            @Size(max = 120) String spell,
            @Size(max = 80) String playerName,
            @PositiveOrZero Integer playerPower,
            @DecimalMin("0") @DecimalMax("100") BigDecimal playerWinRate,
            boolean needsReview,
            @Size(max = 1000) String note
    ) {
    }

    public record ItemCode(
            @Min(1) @Max(6) int slot,
            @NotBlank @Size(max = 120) String code
    ) {
    }

    public record EnchantmentCode(
            @Min(1) @Max(5) int slot,
            @NotBlank @Size(max = 120) String code
    ) {
    }

    public record ArcanaCode(
            @NotBlank @Size(max = 120) String code,
            @Min(1) @Max(10) int quantity
    ) {
    }

    /**
     * Replaces the content of one build. Leaving a part incomplete keeps the build in review; {@code needsReview=false}
     * confirms it and needs every part.
     */
    public record ReviewBuild(
            @Positive long expectedVersion,
            @NotNull @Size(max = 6) List<@Valid @NotNull ItemSlot> items,
            @NotNull @Size(max = 5) List<@Valid @NotNull EnchantmentSlot> enchantments,
            @NotNull @Size(max = 30) List<@Valid @NotNull ArcanaQuantity> arcana,
            UUID spellId,
            @Size(max = 80) String playerName,
            @PositiveOrZero Integer playerPower,
            @DecimalMin("0") @DecimalMax("100") BigDecimal playerWinRate,
            @NotNull Boolean needsReview,
            @Size(max = 1000) String note
    ) {
    }

    public record ItemSlot(
            @Min(1) @Max(6) int slot,
            @NotNull UUID itemId
    ) {
    }

    public record EnchantmentSlot(
            @Min(1) @Max(5) int slot,
            @NotNull UUID enchantmentId
    ) {
    }

    public record ArcanaQuantity(
            @NotNull UUID arcanaId,
            @Min(1) @Max(10) int quantity
    ) {
    }

    public record ConfirmCapture(
            @Positive long expectedVersion
    ) {
    }
}
