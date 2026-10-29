package com.wikiaov.media.internal.query.application;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.application.response.MediaAssetSummary;
import com.wikiaov.media.internal.application.response.UploadStatus;
import com.wikiaov.media.internal.asset.application.MediaAssetAccess;
import com.wikiaov.media.internal.asset.persistence.MediaAssetRepository;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAssetVersion;
import com.wikiaov.media.internal.domain.model.UploadState;
import com.wikiaov.media.internal.provenance.application.MediaCredits;
import com.wikiaov.media.internal.provenance.persistence.MediaProvenanceRepository;
import com.wikiaov.media.internal.provenance.persistence.entity.MediaProvenance;
import com.wikiaov.media.internal.upload.persistence.MediaUploadSessionRepository;
import com.wikiaov.media.internal.upload.persistence.entity.MediaUploadSession;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read side of the admin media API. Reading only needs {@code catalog:read} (URL rule). */
@Service
@Transactional(readOnly = true)
public class MediaAssetQueries {

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"));

    private final MediaAssetRepository assets;
    private final MediaAssetVersionRepository versions;
    private final MediaUploadSessionRepository sessions;
    private final MediaAssetAccess assetAccess;
    private final MediaAssetViews assetViews;
    private final MediaUrls urls;
    private final Clock clock;
    private final MediaProvenanceRepository provenance;

    MediaAssetQueries(MediaAssetRepository assets, MediaAssetVersionRepository versions,
            MediaUploadSessionRepository sessions, MediaAssetAccess assetAccess, MediaAssetViews assetViews,
            MediaUrls urls, Clock clock, MediaProvenanceRepository provenance) {
        this.assets = assets;
        this.versions = versions;
        this.sessions = sessions;
        this.assetAccess = assetAccess;
        this.assetViews = assetViews;
        this.urls = urls;
        this.clock = clock;
        this.provenance = provenance;
    }

    public MediaAssetDetails get(UUID assetId) {
        return assetViews.details(assetAccess.requireAsset(assetId));
    }

    public PageSlice<MediaAssetSummary> list(@Nullable MediaSemanticType semanticType, boolean needsCredit, int page,
            int size) {
        PageRequest request = PageRequest.of(page, size, NEWEST_FIRST);
        Page<MediaAsset> result;
        if (needsCredit) {
            result = assets.findNeedingCredit(semanticType, request);
        } else {
            result = semanticType == null ? assets.findAll(request) : assets.findBySemanticType(semanticType, request);
        }
        List<UUID> currentIds = result.getContent().stream()
                .map(MediaAsset::getCurrentVersionId)
                .filter(Objects::nonNull)
                .toList();
        Map<UUID, MediaAssetVersion> current = currentIds.isEmpty()
                ? Map.of()
                : versions.findByIdIn(currentIds).stream()
                        .collect(Collectors.toMap(MediaAssetVersion::getId, Function.identity()));
        var assetIds = result.getContent().stream().map(MediaAsset::getId).toList();
        var credits = assetIds.isEmpty()
                ? Map.<UUID, List<MediaProvenance>>of()
                : provenance.findByAssetIdInOrderByCreatedAtAscIdAsc(assetIds).stream()
                        .collect(Collectors.groupingBy(MediaProvenance::getAssetId));

        List<MediaAssetSummary> items = result.getContent().stream()
                .map(asset -> {
                    MediaAssetVersion version = asset.getCurrentVersionId() == null
                            ? null
                            : current.get(asset.getCurrentVersionId());
                    return new MediaAssetSummary(asset.getId(), asset.getSemanticType(), asset.getLifecycleState(),
                            asset.getLockVersion(), asset.getCurrentVersionId(),
                            version == null ? null : urls.publicUrl(version), asset.getCreatedAt(),
                            asset.getUpdatedAt(), version == null
                                    ? List.of()
                                    : MediaCredits.forVersion(credits.getOrDefault(asset.getId(), List.of()),
                                            version.getId()));
                })
                .toList();
        return new PageSlice<>(items, page, size, result.getTotalElements());
    }

    public UploadStatus upload(UUID uploadId) {
        MediaUploadSession session = sessions.findById(uploadId)
                .orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_UPLOAD_NOT_FOUND,
                        "Upload " + uploadId + " does not exist."));
        // Expiry is recorded lazily; report it as soon as the deadline has passed.
        UploadState state = session.isPastDeadline(clock.instant()) ? UploadState.EXPIRED : session.getState();
        return new UploadStatus(session.getId(), session.getAssetId(), state, session.getFileName(),
                session.getDeclaredMimeType(), session.getDeclaredSizeBytes(), session.getExpiresAt(),
                session.getVersionId(), session.getErrorCode(), session.getCreatedAt(), session.getCompletedAt());
    }
}
