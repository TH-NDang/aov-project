package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia.References;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia.Usage;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class CompetitionMediaController implements CompetitionMediaApi {
    private final CompetitionMedia media;

    CompetitionMediaController(CompetitionMedia media) {
        this.media = media;
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/media-assets/{assetId}/usage", version = "1")
    public Usage usage(@PathVariable UUID assetId) {
        return media.usage(assetId);
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/media-assets/references", version = "1")
    public References references() {
        return media.references();
    }

    @Override
    @PostMapping(path = ApiPaths.ADMIN + "/media-assets/{assetId}/retire", version = "1")
    public Usage retire(@PathVariable UUID assetId) {
        return media.retire(assetId);
    }
}
