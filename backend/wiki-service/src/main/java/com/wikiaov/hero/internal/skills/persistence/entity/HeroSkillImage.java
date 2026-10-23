package com.wikiaov.hero.internal.skills.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Visual source inventory is independent of immutable gameplay snapshots. */
@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_skill_image")
public class HeroSkillImage {
    @Id
    private UUID id;
    private UUID heroId;
    private String skillKey;
    private int sourceSlot;
    private int variantNo;
    private UUID assetId;
    private String sourceFilename;
    private String label;
    private long version;
    private Instant createdAt;
    private Instant updatedAt;
}
