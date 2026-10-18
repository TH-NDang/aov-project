package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import org.hibernate.annotations.Immutable;

@Entity
@Getter
@Immutable
@Inheritance(strategy = InheritanceType.TABLE_PER_CLASS)
public abstract class HeroChangeClassification {
    @Id
    private UUID id;
    private UUID changeSetId;
    private String changeKind;
}
