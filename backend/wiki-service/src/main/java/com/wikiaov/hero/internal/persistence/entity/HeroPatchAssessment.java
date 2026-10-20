package com.wikiaov.hero.internal.persistence.entity;
import com.wikiaov.hero.internal.domain.HeroChanges.Kind;
import jakarta.persistence.*;
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
    private Kind kind;
    private long version;
    private Instant updatedAt;
    private String updatedByIssuer;
    private String updatedBySubject;
}
