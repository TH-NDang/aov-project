package com.wikiaov.hero.internal.badges.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "skin_badge")
public class SkinBadge {
    @Id
    private UUID id;
    private String code;
    private String kind;
    private UUID groupId;
    private long version;
    private Instant createdAt;
    private Instant updatedAt;
}
