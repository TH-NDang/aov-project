package com.wikiaov.media.internal.application.service;

import com.wikiaov.media.internal.application.MediaProperties;

import com.wikiaov.media.internal.domain.model.MediaObjectKeys;
import com.wikiaov.media.internal.persistence.entity.MediaAssetVersion;

import org.springframework.stereotype.Component;

/**
 * Public URLs of stored versions: {@code /media/{assetId}/{versionId}.{ext}}.
 * The reverse proxy (or CDN) maps {@code /media/} to the {@code assets/} prefix of the bucket (01 section 3.4).
 */
@Component
public class MediaUrls {

    private final String baseUrl;

    MediaUrls(MediaProperties properties) {
        String base = properties.publicBaseUrl();
        this.baseUrl = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    public String publicUrl(MediaAssetVersion version) {
        return baseUrl + "/" + version.getObjectKey().substring(MediaObjectKeys.ASSETS_PREFIX.length());
    }
}
