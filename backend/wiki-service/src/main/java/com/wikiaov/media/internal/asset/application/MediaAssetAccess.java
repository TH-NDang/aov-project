package com.wikiaov.media.internal.asset.application;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.asset.persistence.MediaAssetRepository;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.platform.ApiException;
import java.util.UUID;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;

/** Loads and flushes asset identities with the media module's conflict semantics. */
@Component
public class MediaAssetAccess {
    private final MediaAssetRepository assets;

    public MediaAssetAccess(MediaAssetRepository assets) {
        this.assets = assets;
    }

    public MediaAsset requireAsset(UUID assetId) {
        return assets.findById(assetId).orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_ASSET_NOT_FOUND,
                "Media asset " + assetId + " does not exist."));
    }

    public MediaAsset requireActiveAsset(UUID assetId) {
        MediaAsset asset = requireAsset(assetId);
        MediaWritePolicy.requireActive(asset);
        return asset;
    }

    public MediaAsset flush(MediaAsset asset) {
        try {
            return assets.saveAndFlush(asset);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw MediaWritePolicy.versionConflict(null);
        }
    }
}
