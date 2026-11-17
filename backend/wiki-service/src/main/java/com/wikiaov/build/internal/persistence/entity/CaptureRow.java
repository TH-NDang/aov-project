package com.wikiaov.build.internal.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One capture of a recommendation tab of the game in one market. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "build", name = "capture")
public class CaptureRow extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;

    private String code;
    private String regionCode;
    private String sourceKind;
    private String sourceLabel;
    private Instant capturedAt;
    private String sourceTimeZone;
    private String sourceRun;
    private String sourceNote;
    private UUID patchVariantId;
    private Instant confirmedAt;
    private String confirmedByIssuer;
    private String confirmedBySubject;
    private long version;
    private Instant createdAt;
    private String createdByIssuer;
    private String createdBySubject;
    private Instant updatedAt;
}
