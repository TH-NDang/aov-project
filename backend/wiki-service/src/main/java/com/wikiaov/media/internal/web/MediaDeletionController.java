package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaDeletionView;
import com.wikiaov.media.internal.deletion.application.DeleteMediaAsset;
import com.wikiaov.media.internal.web.request.DeleteMediaRequest;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;

@RestController
class MediaDeletionController implements MediaDeletionApi {
    private final DeleteMediaAsset deletion;

    MediaDeletionController(DeleteMediaAsset deletion) {
        this.deletion = deletion;
    }

    public MediaDeletionView delete(UUID assetId, DeleteMediaRequest request) {
        return deletion.execute(assetId, request.expectedVersion(), request.reason());
    }

    public MediaDeletionView status(UUID assetId) {
        return deletion.status(assetId);
    }
}
