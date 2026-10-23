package com.wikiaov.hero.internal.change.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Getter
@Setter
@Table(schema = "hero", name = "hero_visual_change")
public class VisualChangeClassification extends HeroChangeClassification {
    private String mediaRole;
    private UUID oldAssetId;
    private UUID newAssetId;
}
