package com.wikiaov.hero.internal.skills.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

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
    public static class Key implements java.io.Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
    }
}
