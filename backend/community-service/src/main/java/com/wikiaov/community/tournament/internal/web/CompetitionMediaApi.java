package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia.References;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia.Usage;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@RequestMapping(version = "1")
public interface CompetitionMediaApi {
    @GetMapping(ApiPaths.ADMIN + "/media-assets/{assetId}/usage")
    Usage usage(@PathVariable UUID assetId);

    @GetMapping(ApiPaths.ADMIN + "/media-assets/references")
    References references();

    @PostMapping(ApiPaths.ADMIN + "/media-assets/{assetId}/retire")
    Usage retire(@PathVariable UUID assetId);
}
