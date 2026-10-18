package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "import_job", schema = "hero")
@Getter
@Setter
public class HeroImportJob {
    @Id
    private UUID id;
    @Column(nullable = false)
    private String ownerIssuer;
    @Column(nullable = false)
    private String ownerSubject;
    @Column(nullable = false)
    private String ownerType;
    @Column(nullable = false, columnDefinition = "text")
    private String requestJson;
    @Column(nullable = false, columnDefinition = "text")
    private String resultsJson = "[]";
    private int completed;
    private int total;
    @Column(nullable = false)
    private boolean notificationDismissed;
    private Instant createdAt;
    private Instant updatedAt;
}
