package com.wikiaov.hero.internal.sections.persistence.entity;

import com.wikiaov.hero.internal.domain.HeroContent.Verification;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_source_reference")
public class SourceReferenceRow extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    private HeroSection ownerType;

    private UUID ownerRevisionId;

    private int position;

    private String label;

    private String sourceUrl;

    private Instant observedAt;

    @Enumerated(EnumType.STRING)
    private Verification verificationState;

    private String note;

}
