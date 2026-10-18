package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import org.hibernate.annotations.Immutable;

@Entity
@Getter
@Immutable
@Table(schema = "hero", name = "hero_patch_change_set")
public class HeroPatchChangeSet {
    @Id
    private UUID id;
    private UUID heroId;
    private UUID patchVariantId;
    private UUID fromHeroRevisionId;
    private UUID toHeroRevisionId;
    private Instant createdAt;
}
