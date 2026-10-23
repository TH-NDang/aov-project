package com.wikiaov.media.internal.shared.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.Capabilities;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.ingestion.domain.image.InvalidMediaException;
import com.wikiaov.platform.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/** Shared write guards and audit metadata; persistence belongs to focused capabilities. */
public final class MediaWritePolicy {

    /** Layer 2 of the access checks (01 section 20.4): every media write needs {@code media:write}. */
    public static final String CAN_WRITE_MEDIA = "hasAuthority('" + Capabilities.MEDIA_WRITE + "')";
    public static final String AUDIT_AGGREGATE = "MEDIA_ASSET";

    private MediaWritePolicy() {
    }

    public static void requireActive(MediaAsset asset) {
        if (!asset.isActive()) {
            throw new ApiException(MediaErrorCode.MEDIA_ASSET_NOT_ACTIVE,
                    "Media asset " + asset.getId() + " is " + asset.getLifecycleState() + ".",
                    Map.of("state", asset.getLifecycleState().name()));
        }
    }

    public static void checkExpectedVersion(MediaAsset asset, long expectedVersion) {
        if (asset.getLockVersion() != expectedVersion) {
            throw versionConflict(asset.getLockVersion());
        }
    }

    public static ApiException versionConflict(@Nullable Long currentVersion) {
        String detail = "The media asset was modified by another request.";
        return currentVersion == null
                ? new ApiException(MediaErrorCode.MEDIA_ASSET_VERSION_CONFLICT, detail)
                : new ApiException(MediaErrorCode.MEDIA_ASSET_VERSION_CONFLICT, detail,
                        Map.of("currentVersion", currentVersion));
    }

    public static ActorRef ref(Actor actor) {
        return new ActorRef(actor.issuer(), actor.subject());
    }

    public static ApiException invalidMedia(InvalidMediaException ex) {
        return new ApiException(MediaErrorCode.INVALID_MEDIA_OBJECT, ex.getMessage(), List.of(),
                Map.of("reason", ex.reason().name()), ex);
    }

    /** Audit metadata without null values. */
    public static Map<String, Object> metadata(Object... keysAndValues) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            if (keysAndValues[i + 1] != null) {
                metadata.put((String) keysAndValues[i], keysAndValues[i + 1]);
            }
        }
        return metadata;
    }

}
