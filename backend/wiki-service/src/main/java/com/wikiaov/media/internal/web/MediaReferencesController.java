package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.provenance.application.UpdateMediaReferences;
import com.wikiaov.media.internal.web.request.SourceReferencesRequest;
import com.wikiaov.platform.ApiPaths;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/media")
public class MediaReferencesController implements MediaReferencesApi {
    private final UpdateMediaReferences update;

    public MediaReferencesController(UpdateMediaReferences update) {
        this.update = update;
    }

    @PutMapping(path = "/assets/{assetId}/sources/{sourceId}/references", version = "1")
    public MediaAssetDetails update(@PathVariable UUID assetId, @PathVariable UUID sourceId,
            @RequestBody SourceReferencesRequest request) {
        return update.execute(assetId, sourceId, request.expectedVersion(), request.ownerPageId(),
                request.relatedPageId());
    }
}
