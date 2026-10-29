package com.wikiaov.media.internal.application;

import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;
import com.wikiaov.media.internal.provenance.persistence.entity.MediaProvenance;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Where an artwork came from, as supplied by the caller. */
public record SourceInput(
        ProvenanceSourceType type,
        String label,
        @Nullable String url,
        @Nullable Instant observedAt,
        @Nullable String note,
        @Nullable String ownerName,
        @Nullable String contactUrl
) {

    public SourceInput(ProvenanceSourceType type, String label, @Nullable String url,
            @Nullable Instant observedAt, @Nullable String note) {
        this(type, label, url, observedAt, note, null, null);
    }

    public MediaProvenance toProvenance(UUID assetId, @Nullable UUID versionId, Instant now) {
        return MediaProvenance.record(UUID.randomUUID(), assetId, versionId, type, label, url, observedAt, note,
                ownerName, contactUrl, now);
    }
}
