package com.wikiaov.patch.internal.ruleset.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "region_ruleset_assignment")
public class RulesetAssignment {
    @Id
    private UUID id;

    private UUID regionId;

    private UUID rulesetId;

    private Instant validFrom;

    private Instant validTo;

}
