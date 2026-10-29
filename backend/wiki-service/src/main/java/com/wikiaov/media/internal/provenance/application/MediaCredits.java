package com.wikiaov.media.internal.provenance.application;

import com.wikiaov.media.MediaCredit;
import com.wikiaov.media.internal.provenance.persistence.entity.MediaProvenance;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Version-specific credits take precedence over legacy asset-wide attribution. */
public final class MediaCredits {

    private MediaCredits() {
    }

    public static List<MediaCredit> forVersion(List<MediaProvenance> records, UUID versionId) {
        var specific = records.stream().filter(record -> versionId.equals(record.getAssetVersionId())).toList();
        var selected = specific.isEmpty()
                ? records.stream().filter(record -> record.getAssetVersionId() == null).toList()
                : specific;
        return selected.stream().map(record -> new MediaCredit(record.getSourceType().name(), record.getSourceLabel(),
                publicUrl(record.getSourceUrl()), record.getOwnerName(), publicUrl(record.getContactUrl()),
                record.getObservedAt()))
                .distinct().toList();
    }

    private static @Nullable String publicUrl(@Nullable String value) {
        if (value == null) {
            return null;
        }
        try {
            URI uri = URI.create(value);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null ? value : null;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
