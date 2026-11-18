package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
    @Enumerated(EnumType.STRING)
    private MediaRole mediaRole;
    private UUID oldAssetId;
    private UUID newAssetId;
}
