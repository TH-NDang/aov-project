package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia.References;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia.Usage;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;

@RestController
class CompetitionMediaController implements CompetitionMediaApi {
    private final CompetitionMedia media;

    CompetitionMediaController(CompetitionMedia media) {
        this.media = media;
    }

    public Usage usage(UUID assetId) {
        return media.usage(assetId);
    }

    public References references() {
        return media.references();
    }

    public Usage retire(UUID assetId) {
        return media.retire(assetId);
    }
}
