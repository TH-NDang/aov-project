package com.wikiaov.hero.internal.sections.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;
import com.wikiaov.platform.RevisionState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@MappedSuperclass
@Getter
@Setter
public abstract class SectionRevision extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;
    private UUID heroId;
    @Enumerated(EnumType.STRING)
    private RevisionState state;
    private long version = 1;
    private Instant createdAt;
    private String createdByIssuer;
    private String createdBySubject;
}
