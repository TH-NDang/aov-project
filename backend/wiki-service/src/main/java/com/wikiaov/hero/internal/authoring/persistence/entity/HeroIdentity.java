package com.wikiaov.hero.internal.authoring.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero")
public class HeroIdentity extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;

    private String code;

    private Instant createdAt;

    private String createdByIssuer;

    private String createdBySubject;

}
