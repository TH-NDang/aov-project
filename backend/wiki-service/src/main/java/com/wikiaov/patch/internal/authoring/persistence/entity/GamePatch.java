package com.wikiaov.patch.internal.authoring.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "game_patch")
public class GamePatch {
    @Id
    private UUID id;

    private String code;

    @Column(insertable = false, updatable = false)
    private long sequence;

    private String status;

    private Instant createdAt;

    private String createdByIssuer;

    private String createdBySubject;

}
