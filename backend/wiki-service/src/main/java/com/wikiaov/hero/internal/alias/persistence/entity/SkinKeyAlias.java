package com.wikiaov.hero.internal.alias.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;

@Entity
@Getter
@Table(schema = "hero", name = "skin_key_alias")
public class SkinKeyAlias {
    @Id
    private UUID id;
    private UUID heroId;
    private String legacyKey;
    private String skinKey;
}
