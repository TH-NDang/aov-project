package com.wikiaov.patch.internal.ruleset.persistence.entity;

import com.wikiaov.patch.internal.domain.PatchLifecycleState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "gameplay_ruleset")
public class GameplayRuleset {
    @Id
    private UUID id;

    private String code;

    private String description;

    @Enumerated(EnumType.STRING)
    private PatchLifecycleState lifecycleState;

    private Instant createdAt;

}
