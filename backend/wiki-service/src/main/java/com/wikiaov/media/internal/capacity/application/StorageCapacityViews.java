package com.wikiaov.media.internal.capacity.application;

import com.wikiaov.media.internal.capacity.application.port.R2Analytics;
import com.wikiaov.media.internal.capacity.domain.CapacityLevel;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Response bodies of the storage report (03, ADR-030 storage usage section). */
public final class StorageCapacityViews {

    private StorageCapacityViews() {
    }

    public enum BucketRole {
        MEDIA_ASSETS,
        SOURCES,
        STAGING
    }

    /** Where a figure comes from: the catalog in the database, an estimate, or Cloudflare's own analytics. */
    public enum FigureSource {
        DATABASE,
        ESTIMATE,
        CLOUDFLARE
    }

    public enum Target {
        MEDIA,
        SOURCES
    }

    public record FreeTier(
            long storageBytes,
            long classAOperations,
            long classBOperations
    ) {
    }

    public record Prices(
            BigDecimal storageUsdPerGigabyteMonth,
            BigDecimal classAUsdPerMillion,
            BigDecimal classBUsdPerMillion
    ) {
    }

    public record Thresholds(
            double warning,
            double critical
    ) {
    }

    public record Group(
            String key,
            long files,
            long bytes
    ) {
    }

    public record Bucket(
            BucketRole role,
            String bucket,
            long files,
            long bytes,
            @Nullable Long orphanFiles,
            @Nullable Long orphanBytes,
            List<Group> groups
    ) {

        public Bucket {
            groups = List.copyOf(groups);
        }
    }

    public record Storage(
            FigureSource source,
            long bytes,
            double share,
            CapacityLevel level
    ) {
    }

    public record Operations(
            FigureSource source,
            String month,
            long classA,
            long classB,
            double classAShare,
            double classBShare,
            CapacityLevel classALevel,
            CapacityLevel classBLevel
    ) {
    }

    public record Month(
            String month,
            long files,
            long bytes,
            long classA,
            long classB
    ) {
    }

    public record Cloudflare(
            R2Analytics.State state,
            @Nullable Instant checkedAt,
            @Nullable List<R2Analytics.Bucket> buckets,
            R2Analytics.@Nullable Operations operations
    ) {
    }

    public record Summary(
            Instant generatedAt,
            long bytesPerGigabyte,
            FreeTier freeTier,
            Prices prices,
            Thresholds thresholds,
            List<Bucket> buckets,
            Storage storage,
            Operations operations,
            List<Month> months,
            Cloudflare cloudflare
    ) {
    }

    public record EstimateFile(
            @Nullable String sha256,
            long sizeBytes
    ) {
    }

    public record Estimate(
            Target target,
            long files,
            long bytes,
            long knownFiles,
            long knownBytes,
            long newFiles,
            long newBytes,
            long classA,
            long classB,
            long storageBytesAfter,
            double storageShareAfter,
            CapacityLevel level
    ) {
    }
}
