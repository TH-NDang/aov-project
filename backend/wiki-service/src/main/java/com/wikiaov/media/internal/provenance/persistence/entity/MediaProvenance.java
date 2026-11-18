package com.wikiaov.media.internal.provenance.persistence.entity;

import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;
import com.wikiaov.media.internal.shared.persistence.entity.AssignedIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;

/**
 * Where an asset or version came from (02 section 18). Informational only: the URL is stored, never fetched.
 */
@Entity
@Table(name = "media_provenance", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaProvenance extends AssignedIdEntity {

    @Id
    private UUID id;

    @Column(name = "asset_id", nullable = false, updatable = false)
    private UUID assetId;

    @Column(name = "asset_version_id", updatable = false)
    private @Nullable UUID assetVersionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 32, updatable = false)
    private ProvenanceSourceType sourceType;

    @Column(name = "source_label", nullable = false, updatable = false)
    private String sourceLabel;

    @Column(name = "source_url", updatable = false)
    private @Nullable String sourceUrl;

    @Column(name = "observed_at", updatable = false)
    private @Nullable Instant observedAt;

    @Column(name = "note", updatable = false)
    private @Nullable String note;

    /** Recorded without any evidence of where the image came from; it never counts as a credit (V074). */
    @Column(name = "unverified", nullable = false, updatable = false)
    private boolean unverified;

    /** Copy of the owner's display name; owner renames and merges rewrite it (ADR-017). */
    @Column(name = "owner_name", length = 200, updatable = false)
    private @Nullable String ownerName;

    @Column(name = "owner_id", updatable = false)
    private @Nullable UUID ownerId;

    @Column(name = "contact_url", length = 2048, updatable = false)
    private @Nullable String contactUrl;

    /** Soft references to community pages; never interpreted as ownership verification. */
    @Column(name = "owner_page_id")
    private @Nullable UUID ownerPageId;

    @Column(name = "related_page_id")
    private @Nullable UUID relatedPageId;

    @Version
    @Column(name = "reference_version", nullable = false)
    private long referenceVersion;

    public void reference(@Nullable UUID ownerPageId, @Nullable UUID relatedPageId) {
        this.ownerPageId = ownerPageId;
        this.relatedPageId = relatedPageId;
    }

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static MediaProvenance record(UUID id, UUID assetId, @Nullable UUID assetVersionId,
            ProvenanceSourceType sourceType, String sourceLabel, @Nullable String sourceUrl,
            @Nullable Instant observedAt, @Nullable String note, @Nullable UUID ownerId, @Nullable String ownerName,
            @Nullable String contactUrl, @Nullable UUID ownerPageId, @Nullable UUID relatedPageId, Instant now) {
        MediaProvenance provenance = new MediaProvenance();
        provenance.id = id;
        provenance.assetId = assetId;
        provenance.assetVersionId = assetVersionId;
        provenance.sourceType = sourceType;
        provenance.sourceLabel = sourceLabel;
        provenance.sourceUrl = sourceUrl;
        provenance.observedAt = observedAt;
        provenance.note = note;
        provenance.ownerId = ownerId;
        provenance.ownerName = ownerName;
        provenance.contactUrl = contactUrl;
        provenance.ownerPageId = ownerPageId;
        provenance.relatedPageId = relatedPageId;
        provenance.createdAt = now;
        return provenance;
    }

    /**
     * The placeholder written when a new version arrives without a source: it shows {@code label} to editors and keeps
     * the image in the list of images that need a credit.
     */
    public static MediaProvenance unverified(UUID id, UUID assetId, UUID assetVersionId, String label,
            @Nullable String note, Instant now) {
        MediaProvenance provenance = record(id, assetId, assetVersionId, ProvenanceSourceType.OTHER, label, null, null,
                note, null, null, null, null, null, now);
        provenance.unverified = true;
        return provenance;
    }
}
