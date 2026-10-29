package com.wikiaov.media.internal.upload.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.MediaProperties;
import com.wikiaov.media.internal.application.SourceInput;
import com.wikiaov.media.internal.application.response.UploadTicket;
import com.wikiaov.media.internal.asset.application.MediaAssetAccess;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.domain.model.MediaObjectKeys;
import com.wikiaov.media.internal.ingestion.domain.image.ImageFormat;
import com.wikiaov.media.internal.ingestion.domain.image.InvalidMediaReason;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.media.internal.storage.application.port.ObjectStorage;
import com.wikiaov.media.internal.storage.application.port.PresignedRequest;
import com.wikiaov.media.internal.upload.persistence.MediaUploadSessionRepository;
import com.wikiaov.media.internal.upload.persistence.entity.MediaUploadSession;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiFieldError;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Authorizes one direct upload (03 section 31): the client PUTs the bytes to a presigned URL under
 * {@code incoming/}, then calls complete. The declared type and size are only a first filter; the bytes are
 * checked again on completion.
 */
@Service
public class RequestMediaUpload {

    private final MediaUploadSessionRepository sessions;
    private final ObjectStorage storage;
    private final MediaAssetAccess assetAccess;
    private final MediaProperties properties;
    private final CurrentActor currentActor;
    private final Clock clock;

    RequestMediaUpload(MediaUploadSessionRepository sessions, ObjectStorage storage, MediaAssetAccess assetAccess,
            MediaProperties properties, CurrentActor currentActor, Clock clock) {
        this.sessions = sessions;
        this.storage = storage;
        this.assetAccess = assetAccess;
        this.properties = properties;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    public record Command(
            UUID assetId,
            @Nullable String fileName,
            String contentType,
            long sizeBytes,
            @Nullable SourceInput source
    ) {
        public Command(UUID assetId, @Nullable String fileName, String contentType, long sizeBytes) {
            this(assetId, fileName, contentType, sizeBytes, null);
        }
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public UploadTicket execute(Command command) {
        return issue(command);
    }

    @Transactional
    public UploadTicket avatar(Command command) {
        Actor actor = currentActor.require();
        MediaAsset asset = assetAccess.requireActiveAsset(command.assetId());
        if (actor.type() != com.wikiaov.access.ActorType.HUMAN
                || asset.getSemanticType() != com.wikiaov.media.MediaSemanticType.USER_AVATAR
                || !asset.getCreatedByIssuer().equals(actor.issuer())
                || !asset.getCreatedBySubject().equals(actor.subject()) || asset.hasCurrentVersion()) {
            throw new ApiException(com.wikiaov.platform.PlatformErrorCode.FORBIDDEN,
                    "Avatar upload is not owned by this caller.");
        }
        return issue(command);
    }

    private UploadTicket issue(Command command) {
        Actor actor = currentActor.require();
        MediaAsset asset = assetAccess.requireActiveAsset(command.assetId());
        ImageFormat format = ImageFormat.fromMimeType(command.contentType())
                .orElseThrow(() -> rejected(InvalidMediaReason.UNSUPPORTED_FORMAT, "contentType", "UNSUPPORTED_VALUE",
                        "Only image/png, image/jpeg and image/webp can be uploaded.", Map.of()));
        long maxBytes = properties.maxUploadSize().toBytes();
        if (command.sizeBytes() > maxBytes) {
            throw rejected(InvalidMediaReason.TOO_LARGE, "sizeBytes", "TOO_LARGE",
                    "The file must be at most " + maxBytes + " bytes.", Map.of("maxBytes", maxBytes));
        }

        Instant now = clock.instant();
        UUID uploadId = UUID.randomUUID();
        String objectKey = MediaObjectKeys.incoming(uploadId);
        Instant completeBefore = now.plus(properties.completionWindow());
        var session = MediaUploadSession.request(uploadId, asset.getId(), objectKey, fileName(command.fileName()),
                format, command.sizeBytes(), completeBefore, MediaWritePolicy.ref(actor), now);
        if (command.source() != null) {
            var source = command.source();
            session.recordSource(source.type(), source.label(), source.url(), source.ownerName(), source.contactUrl(),
                    source.observedAt(), source.note());
        }
        sessions.save(session);
        // Signing is a local computation; no network call happens inside the transaction.
        PresignedRequest put = storage.presignPut(objectKey, format.mimeType(), properties.uploadUrlValidity());
        return new UploadTicket(uploadId, asset.getId(), objectKey, put.method(), put.url(), put.headers(),
                put.expiresAt(), completeBefore);
    }

    /** Keeps only the last path segment of a client-supplied name; it is stored for display only. */
    private static @Nullable String fileName(@Nullable String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return null;
        }
        String name = fileName.strip();
        int separator = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        return name.substring(separator + 1);
    }

    private static ApiException rejected(InvalidMediaReason reason, String field, String fieldCode, String message,
            Map<String, Object> extraContext) {
        Map<String, Object> context = new LinkedHashMap<>(extraContext);
        context.put("reason", reason.name());
        return new ApiException(MediaErrorCode.INVALID_MEDIA_OBJECT, message,
                List.of(new ApiFieldError(field, fieldCode, message)), context, null);
    }
}
