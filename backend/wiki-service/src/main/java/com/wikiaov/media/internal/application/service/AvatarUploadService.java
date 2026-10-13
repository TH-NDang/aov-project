package com.wikiaov.media.internal.application.service;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.AvatarUploads;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.application.port.ObjectStorage;
import com.wikiaov.media.internal.persistence.MediaAssetRepository;
import com.wikiaov.media.internal.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.persistence.entity.MediaAsset;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
class AvatarUploadService implements AvatarUploads {
    private final MediaAssetRepository assets;
    private final MediaAssetVersionRepository versions;
    private final RequestMediaUpload request;
    private final CompleteMediaUpload complete;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final ObjectStorage storage;
    private final TransactionTemplate transaction;
    private final Clock clock;

    AvatarUploadService(MediaAssetRepository assets, MediaAssetVersionRepository versions, RequestMediaUpload request,
            CompleteMediaUpload complete, CurrentActor actors, AuditLog audit, ObjectStorage storage,
            TransactionTemplate transaction, Clock clock) {
        this.assets = assets;
        this.versions = versions;
        this.request = request;
        this.complete = complete;
        this.actors = actors;
        this.audit = audit;
        this.storage = storage;
        this.transaction = transaction;
        this.clock = clock;
    }

    public Ticket begin(String fileName, String contentType, long sizeBytes) {
        Actor actor = human();
        return transaction.execute(status -> {
            MediaAsset asset = assets.save(MediaAsset.create(UUID.randomUUID(), MediaSemanticType.USER_AVATAR,
                    MediaSupport.ref(actor), clock.instant()));
            audit.record(AuditEntry.of(actor, "MEDIA_AVATAR_CREATED", "MEDIA_ASSET", asset.getId()));
            var ticket = request
                    .avatar(new RequestMediaUpload.Command(asset.getId(), fileName, contentType, sizeBytes));
            return new Ticket(ticket.uploadId(), ticket.assetId(), ticket.method(), ticket.uploadUrl(),
                    ticket.headers(), ticket.expiresAt());
        });
    }

    public Result complete(UUID uploadId) {
        human();
        var result = complete.avatar(uploadId);
        return new Result(result.assetId(), previewUrl(result.assetId()).orElseThrow());
    }

    public boolean canBind(UUID assetId) {
        Actor actor = human();
        return assets.findById(assetId).filter(asset -> asset.isActive() && asset.hasCurrentVersion()
                && asset.getSemanticType() == MediaSemanticType.USER_AVATAR
                && asset.getCreatedByIssuer().equals(actor.issuer())
                && asset.getCreatedBySubject().equals(actor.subject()))
                .flatMap(asset -> versions.findById(asset.getCurrentVersionId()))
                .filter(version -> version.isReady())
                .isPresent();
    }

    /** Signing is local; the browser reads bytes directly from storage, even when the bucket is private. */
    public Optional<String> previewUrl(UUID assetId) {
        return assets.findById(assetId).filter(asset -> asset.isActive() && asset.hasCurrentVersion()
                && asset.getSemanticType() == MediaSemanticType.USER_AVATAR)
                .flatMap(asset -> versions.findById(asset.getCurrentVersionId()))
                .filter(version -> version.isReady())
                .map(version -> storage.presignGet(version.getObjectKey(), Duration.ofMinutes(15)).url().toString());
    }

    private Actor human() {
        Actor actor = actors.require();
        if (actor.type() != ActorType.HUMAN)
            throw new ApiException(PlatformErrorCode.FORBIDDEN, "A human account is required.");
        return actor;
    }
}
