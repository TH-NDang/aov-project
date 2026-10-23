package com.wikiaov.hero.internal.sections.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_source_reference")
public class SourceReferenceRow extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;

    private String ownerType;

    private UUID ownerRevisionId;

    private int position;

    private String label;

    private String sourceUrl;

    private Instant observedAt;

    private String verificationState;

    private String note;

}
