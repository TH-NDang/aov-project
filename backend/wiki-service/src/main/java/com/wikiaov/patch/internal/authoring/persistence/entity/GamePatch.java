package com.wikiaov.patch.internal.authoring.persistence.entity;

import com.wikiaov.patch.internal.domain.PatchStatus;
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

    @Enumerated(EnumType.STRING)
    private PatchStatus status;

    private Instant createdAt;

    private String createdByIssuer;

    private String createdBySubject;

}
