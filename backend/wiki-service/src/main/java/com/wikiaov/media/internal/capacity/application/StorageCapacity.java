package com.wikiaov.media.internal.capacity.application;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews.Bucket;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews.BucketRole;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews.EstimateFile;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews.FigureSource;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews.Group;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews.Target;
import com.wikiaov.media.internal.capacity.application.port.R2Analytics;
import com.wikiaov.media.internal.capacity.domain.CapacityLevel;
import com.wikiaov.media.internal.capacity.domain.R2Operations;
import com.wikiaov.media.internal.capacity.domain.StorageReading;
import com.wikiaov.media.internal.source.application.SourceOrphans;
import com.wikiaov.media.internal.source.domain.SourceDigest;
import com.wikiaov.media.internal.source.persistence.SourceObjectRepository;
import com.wikiaov.media.internal.source.persistence.SourceUploadSessionRepository;
import com.wikiaov.media.internal.storage.application.port.StorageLayout;
import com.wikiaov.media.internal.upload.persistence.MediaUploadSessionRepository;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiFieldError;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * How much of the R2 free tier the project uses (ADR-030 sections 9 and 10). Figures come from the media and source
 * catalogs in the database; Cloudflare analytics, when configured, replace them with what Cloudflare measures.
 */
@Service
@EnableConfigurationProperties(CapacityProperties.class)
public class StorageCapacity {

    public static final int MAX_ESTIMATED_FILES = 20_000;
    private static final int MONTHS = 12;
    /** Keeps each IN list well below the PostgreSQL limit on bind parameters. */
    private static final int LOOKUP_CHUNK = 5_000;

    private final MediaAssetVersionRepository mediaVersions;
    private final MediaUploadSessionRepository mediaUploads;
    private final SourceObjectRepository sourceObjects;
    private final SourceUploadSessionRepository sourceUploads;
    private final SourceOrphans orphans;
    private final StorageLayout layout;
    private final R2Analytics analytics;
    private final CapacityProperties properties;
    private final Clock clock;
    private final TransactionTemplate readOnly;

    StorageCapacity(MediaAssetVersionRepository mediaVersions, MediaUploadSessionRepository mediaUploads,
            SourceObjectRepository sourceObjects, SourceUploadSessionRepository sourceUploads, SourceOrphans orphans,
            StorageLayout layout, R2Analytics analytics, CapacityProperties properties, Clock clock,
            PlatformTransactionManager transactions) {
        this.mediaVersions = mediaVersions;
        this.mediaUploads = mediaUploads;
        this.sourceObjects = sourceObjects;
        this.sourceUploads = sourceUploads;
        this.orphans = orphans;
        this.layout = layout;
        this.analytics = analytics;
        this.properties = properties;
        this.clock = clock;
        this.readOnly = new TransactionTemplate(transactions);
        this.readOnly.setReadOnly(true);
    }

    /**
     * Cloudflare is asked first, outside any transaction, so no database connection waits on its API; the catalog
     * figures are then read together in one read-only transaction.
     */
    public StorageCapacityViews.Summary summary() {
        Instant now = clock.instant();
        R2Analytics.Usage cloudflare = analytics.read(bucketNames());
        Catalog catalog = readOnly.execute(status -> new Catalog(buckets(now), months(now)));

        List<Bucket> buckets = catalog.buckets();
        long databaseBytes = buckets.stream().mapToLong(Bucket::bytes).sum();
        List<StorageCapacityViews.Month> months = catalog.months();
        String currentMonth = YearMonth.from(now.atZone(ZoneOffset.UTC)).toString();
        StorageCapacityViews.Month thisMonth = months.stream().filter(month -> month.month().equals(currentMonth))
                .findFirst().orElse(new StorageCapacityViews.Month(currentMonth, 0, 0, 0, 0));

        return new StorageCapacityViews.Summary(now, CapacityProperties.BYTES_PER_GIGABYTE,
                new StorageCapacityViews.FreeTier(properties.freeStorageBytes(), properties.freeClassAOperations(),
                        properties.freeClassBOperations()),
                new StorageCapacityViews.Prices(properties.storageUsdPerGbMonth(), properties.classAUsdPerMillion(),
                        properties.classBUsdPerMillion()),
                new StorageCapacityViews.Thresholds(properties.warningRatio(), properties.criticalRatio()),
                buckets, storage(databaseBytes, cloudflare), operations(currentMonth, thisMonth, cloudflare), months,
                new StorageCapacityViews.Cloudflare(cloudflare.state(), cloudflare.checkedAt(),
                        cloudflare.state() == R2Analytics.State.OK ? cloudflare.buckets() : null,
                        cloudflare.operations()));
    }

    /**
     * What an upload batch would add. Source bytes already stored cost nothing; media uploads store a copy per asset,
     * so known bytes are only reported as duplicates. Like {@link #summary()}, Cloudflare is asked before the
     * read-only transaction opens.
     */
    public StorageCapacityViews.Estimate estimate(Target target, @Nullable List<EstimateFile> files) {
        validate(files);

        R2Analytics.Usage cloudflare = analytics.read(bucketNames());
        Stored stored = readOnly.execute(status -> new Stored(known(target, files),
                buckets(clock.instant()).stream().mapToLong(Bucket::bytes).sum()));
        Set<String> known = stored.sha256s();

        long bytes = 0;
        long knownFiles = 0;
        long knownBytes = 0;
        long newFiles = 0;
        long newBytes = 0;
        Set<String> counted = new HashSet<>();
        for (EstimateFile file : files) {
            bytes += file.sizeBytes();
            boolean isKnown = file.sha256() != null && known.contains(file.sha256());
            if (isKnown) {
                knownFiles++;
                knownBytes += file.sizeBytes();
            }
            boolean repeated = target == Target.SOURCES && file.sha256() != null && !counted.add(file.sha256());
            if (target == Target.MEDIA || !isKnown && !repeated) {
                newFiles++;
                newBytes += file.sizeBytes();
            }
        }

        long current = storage(stored.databaseBytes(), cloudflare).bytes();
        long after = current + newBytes;
        double share = (double) after / properties.freeStorageBytes();
        return new StorageCapacityViews.Estimate(target, files.size(), bytes, knownFiles, knownBytes, newFiles,
                newBytes, newFiles * R2Operations.CLASS_A_PER_STORED_FILE,
                newFiles * R2Operations.CLASS_B_PER_STORED_FILE, after, share, level(share));
    }

    private List<Bucket> buckets(Instant now) {
        List<Group> mediaGroups = mediaVersions.totalsBySemanticType().stream()
                .map(total -> new Group(total.getSemanticType().name(), total.getFiles(), total.getBytes()))
                .sorted(Comparator.comparingLong(Group::bytes).reversed())
                .toList();
        long mediaFiles = mediaGroups.stream().mapToLong(Group::files).sum();
        long mediaBytes = mediaGroups.stream().mapToLong(Group::bytes).sum();

        var sources = sourceObjects.total();
        List<Group> sourceGroups = sourceObjects.totalsByCategory().stream()
                .map(total -> new Group(total.getKey(), total.getFiles(), total.getBytes()))
                .sorted(Comparator.comparingLong(Group::bytes).reversed())
                .toList();
        SourceOrphans.Totals orphanTotals = orphans.totals();

        var pendingMedia = mediaUploads.pending(now);
        var pendingSources = sourceUploads.pending(now);

        return List.of(
                new Bucket(BucketRole.MEDIA_ASSETS, layout.assetsBucket(), mediaFiles, mediaBytes, null, null,
                        mediaGroups),
                new Bucket(BucketRole.SOURCES, layout.sourcesBucket(), sources.getFiles(), sources.getBytes(),
                        orphanTotals.files(), orphanTotals.bytes(), sourceGroups),
                new Bucket(BucketRole.STAGING, layout.stagingBucket(),
                        pendingMedia.getFiles() + pendingSources.getFiles(),
                        pendingMedia.getBytes() + pendingSources.getBytes(), null, null, List.of()));
    }

    private Set<String> bucketNames() {
        return new LinkedHashSet<>(List.of(layout.assetsBucket(), layout.sourcesBucket(), layout.stagingBucket()));
    }

    private StorageCapacityViews.Storage storage(long databaseBytes, R2Analytics.Usage cloudflare) {
        @Nullable
        Long measured = cloudflare.state() == R2Analytics.State.OK
                ? cloudflare.buckets().stream().mapToLong(R2Analytics.Bucket::bytes).sum()
                : null;
        StorageReading reading = StorageReading.of(databaseBytes, measured);

        double share = (double) reading.bytes() / properties.freeStorageBytes();
        return new StorageCapacityViews.Storage(reading.fromCloudflare()
                ? FigureSource.CLOUDFLARE
                : FigureSource.DATABASE, reading.bytes(), share, level(share));
    }

    private StorageCapacityViews.Operations operations(String month, StorageCapacityViews.Month thisMonth,
            R2Analytics.Usage cloudflare) {
        boolean measured = cloudflare.state() == R2Analytics.State.OK && cloudflare.operations() != null;
        long classA = measured ? cloudflare.operations().classA() : thisMonth.classA();
        long classB = measured ? cloudflare.operations().classB() : thisMonth.classB();
        double shareA = (double) classA / properties.freeClassAOperations();
        double shareB = (double) classB / properties.freeClassBOperations();
        return new StorageCapacityViews.Operations(measured ? FigureSource.CLOUDFLARE : FigureSource.ESTIMATE, month,
                classA, classB, shareA, shareB, level(shareA), level(shareB));
    }

    /** The last twelve UTC months, oldest first; months without uploads are listed with zeros. */
    private List<StorageCapacityViews.Month> months(Instant now) {
        YearMonth current = YearMonth.from(now.atZone(ZoneOffset.UTC));
        YearMonth first = current.minusMonths(MONTHS - 1L);
        Instant from = first.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        Map<String, long[]> totals = new TreeMap<>();
        for (int offset = 0; offset < MONTHS; offset++) {
            totals.put(first.plusMonths(offset).toString(), new long[2]);
        }
        mediaVersions.totalsByMonth(from).forEach(total -> add(totals, total.getMonth(), total.getFiles(),
                total.getBytes()));
        sourceObjects.totalsByMonth(from).forEach(total -> add(totals, total.getMonth(), total.getFiles(),
                total.getBytes()));

        List<StorageCapacityViews.Month> months = new ArrayList<>();
        totals.forEach((month, value) -> months.add(new StorageCapacityViews.Month(month, value[0], value[1],
                value[0] * R2Operations.CLASS_A_PER_STORED_FILE, value[0] * R2Operations.CLASS_B_PER_STORED_FILE)));
        return months;
    }

    private static void add(Map<String, long[]> totals, String month, long files, long bytes) {
        long[] value = totals.get(month);
        if (value != null) {
            value[0] += files;
            value[1] += bytes;
        }
    }

    private void validate(@Nullable List<EstimateFile> files) {
        if (files == null || files.isEmpty()) {
            throw new ApiException(PlatformErrorCode.INVALID_REQUEST, "List at least one file to estimate.",
                    List.of(new ApiFieldError("files", "SIZE", "must contain at least one file")));
        }
        if (files.size() > MAX_ESTIMATED_FILES) {
            throw new ApiException(MediaErrorCode.STORAGE_ESTIMATE_LIMIT_EXCEEDED,
                    "Estimate at most " + MAX_ESTIMATED_FILES + " files at once.", Map.of("max", MAX_ESTIMATED_FILES));
        }

        for (EstimateFile file : files) {
            if (file == null || file.sizeBytes() < 0
                    || file.sha256() != null && !SourceDigest.isSha256(file.sha256())) {
                throw new ApiException(PlatformErrorCode.INVALID_REQUEST,
                        "Every file needs a size of at least 0 and, if given, a lower-case hex SHA-256.",
                        List.of(new ApiFieldError("files", "INVALID_VALUE", "has an invalid size or SHA-256")));
            }
        }
    }

    private Set<String> known(Target target, List<EstimateFile> files) {
        List<String> sha256s = files.stream().map(EstimateFile::sha256).filter(Objects::nonNull).distinct()
                .toList();
        Set<String> known = new HashSet<>();
        for (int start = 0; start < sha256s.size(); start += LOOKUP_CHUNK) {
            List<String> chunk = sha256s.subList(start, Math.min(start + LOOKUP_CHUNK, sha256s.size()));
            known.addAll(target == Target.SOURCES
                    ? sourceObjects.findStoredSha256In(chunk)
                    : mediaVersions.findStoredSha256In(chunk));
        }
        return known;
    }

    private CapacityLevel level(double share) {
        return CapacityLevel.of(share, properties.warningRatio(), properties.criticalRatio());
    }

    private record Catalog(
            List<Bucket> buckets,
            List<StorageCapacityViews.Month> months
    ) {
    }

    private record Stored(
            Set<String> sha256s,
            long databaseBytes
    ) {
    }
}
