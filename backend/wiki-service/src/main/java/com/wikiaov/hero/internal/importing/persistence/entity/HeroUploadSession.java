package com.wikiaov.hero.internal.importing.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "upload_session", schema = "hero")
@Getter
@Setter
public class HeroUploadSession {
    @Id
    private UUID id;
    private String ownerIssuer;
    private String ownerSubject;
    @Column(columnDefinition = "text")
    private String stateJson;
    private long version;
    private Instant updatedAt;
}
