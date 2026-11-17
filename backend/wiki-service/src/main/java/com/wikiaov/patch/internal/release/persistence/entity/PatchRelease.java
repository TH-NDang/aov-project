package com.wikiaov.patch.internal.release.persistence.entity;

import com.wikiaov.patch.internal.domain.PatchReleaseStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "patch_release")
public class PatchRelease {
    @Id
    private UUID id;

    private UUID patchVariantId;

    private UUID regionId;

    private Instant effectiveAt;
    private java.time.LocalDate effectiveOn;
    private Instant confirmedAt;

    private Instant announcedAt;

    @Enumerated(EnumType.STRING)
    private PatchReleaseStatus status;

    private String sourceUrl;

    private Instant createdAt;

    private UUID seasonId;

}
