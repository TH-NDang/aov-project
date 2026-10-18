package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "skin_badge_group")
public class SkinBadgeGroup {
    @Id
    private UUID id;
    private String code;
    private String kind;
    private long version;
    private Instant createdAt;
    private Instant updatedAt;
}
