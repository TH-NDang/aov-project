package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.hero.internal.domain.HeroChanges.OverallKind;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_patch_assessment")
public class HeroPatchAssessment {
    @Id
    private UUID changeSetId;
    @Enumerated(EnumType.STRING)
    private OverallKind kind;
    private long version;
    private Instant updatedAt;
    private String updatedByIssuer;
    private String updatedBySubject;
}
