package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;

@Entity
@Getter
@Table(schema = "hero", name = "skin_badge_code_alias")
public class SkinBadgeCodeAlias {
    @Id
    private String legacyCode;
    private UUID badgeId;
}
