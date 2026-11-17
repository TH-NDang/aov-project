package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.provenance.application.UpdateMediaReferences;
import com.wikiaov.media.internal.web.request.SourceReferencesRequest;
import com.wikiaov.platform.ApiPaths;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/media")
public class MediaReferencesController implements MediaReferencesApi {
    private final UpdateMediaReferences update;

    public MediaReferencesController(UpdateMediaReferences update) {
        this.update = update;
    }

    @Override
    @PutMapping(path = "/assets/{assetId}/sources/{sourceId}/references", version = "1")
    public MediaAssetDetails update(@PathVariable UUID assetId, @PathVariable UUID sourceId,
            @RequestBody SourceReferencesRequest request) {
        return update.execute(assetId, sourceId, request.expectedVersion(), request.ownerPageId(),
                request.relatedPageId());
    }
}
