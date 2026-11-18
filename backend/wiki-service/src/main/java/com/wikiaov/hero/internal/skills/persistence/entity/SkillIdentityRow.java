package com.wikiaov.hero.internal.skills.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
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
@Table(schema = "hero", name = "hero_skill")
@IdClass(SkillIdentityRow.Key.class)
public class SkillIdentityRow extends AssignedIdentifierEntity<SkillIdentityRow.Key> {
    @Id
    private UUID heroId;

    @Id
    private String skillKey;

    private Instant createdAt;

    @Override
    public Key getId() {
        return new Key(heroId, skillKey);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID heroId;
        public String skillKey;
    }
}
