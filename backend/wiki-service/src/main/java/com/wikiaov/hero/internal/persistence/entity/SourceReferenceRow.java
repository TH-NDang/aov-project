package com.wikiaov.hero.internal.persistence.entity;

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
public class SourceReferenceRow {
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
