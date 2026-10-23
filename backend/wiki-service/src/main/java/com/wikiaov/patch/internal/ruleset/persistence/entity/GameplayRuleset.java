package com.wikiaov.patch.internal.ruleset.persistence.entity;

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

    private String lifecycleState;

    private Instant createdAt;

}
