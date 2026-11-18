package com.wikiaov.hero.internal.skills.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
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
@Table(schema = "hero", name = "hero_skill_snapshot")
@IdClass(SkillSnapshotRow.Key.class)
public class SkillSnapshotRow extends AssignedIdentifierEntity<SkillSnapshotRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    private UUID heroId;

    @Id
    private String skillKey;

    private String kind;

    private String formKey;

    private int displayOrder;

    private UUID iconAssetId;

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, skillKey);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
    }
}
