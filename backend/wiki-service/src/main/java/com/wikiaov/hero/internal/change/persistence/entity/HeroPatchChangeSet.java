package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.hero.internal.domain.HeroChanges.ChangeSource;
import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

@Entity
@Getter
@Setter
@Immutable
@Table(schema = "hero", name = "hero_patch_change_set")
public class HeroPatchChangeSet extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;
    private UUID heroId;
    private UUID patchVariantId;
    private UUID fromHeroRevisionId;
    private UUID toHeroRevisionId;
    @Enumerated(EnumType.STRING)
    private ChangeSource sourceKind;
    private String sourceUrl;
    private Instant createdAt;
    private String createdByIssuer;
    private String createdBySubject;
}
