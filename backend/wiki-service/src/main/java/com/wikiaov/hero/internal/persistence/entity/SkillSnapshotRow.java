package com.wikiaov.hero.internal.persistence.entity;

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
public class SkillSnapshotRow {
    @Id
    private UUID skillSetRevisionId;

    private UUID heroId;

    @Id
    private String skillKey;

    private String kind;

    private String formKey;

    private int displayOrder;

    private UUID iconAssetId;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
    }
}
