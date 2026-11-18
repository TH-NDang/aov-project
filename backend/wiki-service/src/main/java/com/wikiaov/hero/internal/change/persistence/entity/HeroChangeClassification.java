package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.hero.internal.domain.HeroChanges.Kind;
import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@MappedSuperclass
@Getter
@Setter
public abstract class HeroChangeClassification extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;
    private UUID changeSetId;
    @Enumerated(EnumType.STRING)
    private Kind changeKind;
    private int sortOrder;
}
