package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

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
    private String changeKind;
    private int sortOrder;
}
