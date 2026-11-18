package com.wikiaov.build.internal.application.response;

import com.wikiaov.build.internal.domain.BuildSource;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Responses for recommended builds (ADR-026). */
public final class BuildViews {
    private BuildViews() {
    }

    public record Summary(
            UUID id,
            String code,
            String regionCode,
            BuildSource sourceKind,
            String sourceLabel,
            Instant capturedAt,
            String sourceTimeZone,
            UUID patchVariantId,
            String patchCode,
            Instant confirmedAt,
            int heroCount,
            int buildCount,
            int needsReviewCount,
            long version
    ) {
    }

    public record Detail(
            UUID id,
            String code,
            String regionCode,
            BuildSource sourceKind,
            String sourceLabel,
            Instant capturedAt,
            String sourceTimeZone,
            UUID patchVariantId,
            String patchCode,
            Instant confirmedAt,
            int heroCount,
            int buildCount,
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
            String fileName,
            int width,
            int height,
            String layout
    ) {
    }

    public record HeroEntry(
            UUID heroId,
            String heroCode,
            String nameOnScreen,
            int captureOrder,
            String result,
            List<Build> builds
    ) {
    }

    public record Build(
            UUID id,
            int position,
            String imageId,
            List<Item> items,
            UUID enchantmentSetId,
            List<Enchantment> enchantments,
            UUID arcanaPageId,
            List<Arcana> arcana,
            UUID spellId,
            String spellCode,
            String contentKey,
            String playerName,
            Integer playerPower,
            BigDecimal playerWinRate,
            boolean needsReview,
            String note,
            Instant reviewedAt,
            long version
    ) {
    }

    public record Item(
            int slot,
            UUID itemId,
            String code
    ) {
    }

    public record Enchantment(
            int slot,
            UUID enchantmentId,
            String code
    ) {
    }

    public record Arcana(
            UUID arcanaId,
            String code,
            int quantity
    ) {
    }

    public record Reviewed(
            Build build,
            Summary capture
    ) {
    }

    /** Builds of one hero shown on the public Wiki. */
    public record HeroBuilds(
            UUID heroId,
            String heroCode,
            String regionCode,
            List<Source> sources
    ) {
    }

    /** The newest confirmed capture of one game tab that lists the hero. */
    public record Source(
            UUID captureId,
            BuildSource sourceKind,
            String sourceLabel,
            Instant capturedAt,
            String sourceTimeZone,
            String patchCode,
            String result,
            List<PublicBuild> builds
    ) {
    }

    /** Builds with the same content are merged; {@code positions} are their places in the game's list. */
    public record PublicBuild(
            String contentKey,
            List<Integer> positions,
            List<PublicItem> items,
            List<Enchantment> enchantments,
            UUID arcanaPageId,
            List<Arcana> arcana,
            Usage arcanaPageUse,
            UUID spellId,
            String spellCode
    ) {
    }

    public record PublicItem(
            int slot,
            UUID itemId,
            String code
    ) {
    }

    /** How many confirmed builds, and of how many heroes, use a shared value. */
    public record Usage(
            int builds,
            int heroes
    ) {
    }
}
