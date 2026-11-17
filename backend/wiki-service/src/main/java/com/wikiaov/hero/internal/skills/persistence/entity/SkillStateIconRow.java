package com.wikiaov.hero.internal.skills.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
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
@Table(schema = "hero", name = "skill_state_icon")
@IdClass(SkillStateIconRow.Key.class)
public class SkillStateIconRow extends AssignedIdentifierEntity<SkillStateIconRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    @Id
    private String skillKey;

    @Id
    private int iconOrder;

    private UUID assetId;

    private String label;

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, skillKey, iconOrder);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
        public int iconOrder;
    }
}
