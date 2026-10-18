package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@MappedSuperclass
@Getter
@Setter
public abstract class SectionRevision {
    @Id
    private UUID id;
    private UUID heroId;
    private String state;
    private long version = 1;
    private Instant createdAt;
    private String createdByIssuer;
    private String createdBySubject;
}
