package com.wikiaov.patch.internal.stats.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "stat_default")
public class PatchStatDefault {
    @Id
    private UUID id;
    private UUID variantId;
    private String statKey;
    private BigDecimal baseValue;
    private String unit;
    private String sourceUrl;
    private long version;
}
