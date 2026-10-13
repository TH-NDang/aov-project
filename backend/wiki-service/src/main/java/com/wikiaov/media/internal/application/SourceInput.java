package com.wikiaov.media.internal.application;

import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;
import com.wikiaov.media.internal.persistence.entity.MediaProvenance;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Where an artwork came from, as supplied by the caller. */
public record SourceInput(
        ProvenanceSourceType type,
        String label,
        @Nullable String url,
        @Nullable Instant observedAt,
        @Nullable String note
) {

    public MediaProvenance toProvenance(UUID assetId, @Nullable UUID versionId, Instant now) {
        return MediaProvenance.record(UUID.randomUUID(), assetId, versionId, type, label, url, observedAt, note, now);
    }
}
