package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
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
