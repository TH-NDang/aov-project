package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;

@Entity
@Getter
@Table(schema = "hero", name = "hero_code_alias")
public class HeroCodeAlias {
    @Id
    private String legacyCode;
    private UUID heroId;
}
