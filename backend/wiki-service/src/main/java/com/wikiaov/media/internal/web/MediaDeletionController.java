package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaDeletionView;
import com.wikiaov.media.internal.deletion.application.DeleteMediaAsset;
import com.wikiaov.media.internal.web.request.DeleteMediaRequest;
import com.wikiaov.platform.ApiPaths;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/media/assets")
class MediaDeletionController implements MediaDeletionApi {
    private final DeleteMediaAsset deletion;

    MediaDeletionController(DeleteMediaAsset deletion) {
        this.deletion = deletion;
    }

    @Override
    @PostMapping(path = "/{assetId}/delete", version = "1")
    public MediaDeletionView delete(@PathVariable UUID assetId, @RequestBody DeleteMediaRequest request) {
        return deletion.execute(assetId, request.expectedVersion(), request.reason());
    }

    @Override
    @GetMapping(path = "/{assetId}/deletion", version = "1")
    public MediaDeletionView status(@PathVariable UUID assetId) {
        return deletion.status(assetId);
    }
}
