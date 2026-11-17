package com.wikiaov.hero.internal.alias.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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
