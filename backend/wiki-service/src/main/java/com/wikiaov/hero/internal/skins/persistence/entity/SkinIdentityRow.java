package com.wikiaov.hero.internal.skins.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_skin")
@IdClass(SkinIdentityRow.Key.class)
public class SkinIdentityRow extends AssignedIdentifierEntity<SkinIdentityRow.Key> {
    @Id
    private UUID heroId;

    @Id
    private String skinKey;

    private Instant createdAt;

    @Override
    public Key getId() {
        return new Key(heroId, skinKey);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID heroId;
        public String skinKey;
    }
}
