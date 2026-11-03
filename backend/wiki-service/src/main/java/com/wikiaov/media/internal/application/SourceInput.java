package com.wikiaov.media.internal.application;

import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;
import com.wikiaov.media.internal.provenance.persistence.entity.MediaProvenance;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Where an artwork came from, as supplied by the caller. {@code ownerId} is set once the owner name is linked to the
 * owner catalog (ADR-017).
 */
public record SourceInput(
        ProvenanceSourceType type,
        String label,
        @Nullable String url,
        @Nullable Instant observedAt,
        @Nullable String note,
        @Nullable String ownerName,
        @Nullable String contactUrl,
        @Nullable UUID ownerId,
        @Nullable UUID ownerPageId,
        @Nullable UUID relatedPageId
) {

    public SourceInput(ProvenanceSourceType type, String label, @Nullable String url,
            @Nullable Instant observedAt, @Nullable String note) {
        this(type, label, url, observedAt, note, null, null, null, null, null);
    }

    public SourceInput(ProvenanceSourceType type, String label, @Nullable String url,
            @Nullable Instant observedAt, @Nullable String note, @Nullable String ownerName,
            @Nullable String contactUrl) {
        this(type, label, url, observedAt, note, ownerName, contactUrl, null, null, null);
    }

    public SourceInput withOwner(@Nullable UUID ownerId, @Nullable String ownerName, @Nullable String contactUrl) {
        return new SourceInput(type, label, url, observedAt, note, ownerName, contactUrl, ownerId, ownerPageId,
                relatedPageId);
    }

    public MediaProvenance toProvenance(UUID assetId, @Nullable UUID versionId, Instant now) {
        return MediaProvenance.record(UUID.randomUUID(), assetId, versionId, type, label, url, observedAt, note,
                ownerId, ownerName, contactUrl, ownerPageId, relatedPageId, now);
    }
}
