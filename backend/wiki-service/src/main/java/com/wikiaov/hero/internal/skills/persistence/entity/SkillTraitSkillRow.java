package com.wikiaov.hero.internal.skills.persistence.entity;

import com.wikiaov.hero.internal.domain.HeroContent.TraitCode;
import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** A skill a trait comes from (ADR-029). Written once with its revision, like {@link SkillTraitRow}. */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(schema = "hero", name = "hero_skill_trait_skill")
@IdClass(SkillTraitSkillRow.Key.class)
public class SkillTraitSkillRow extends AssignedIdentifierEntity<SkillTraitSkillRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    @Id
    @Enumerated(EnumType.STRING)
    private TraitCode traitCode;

    @Id
    private String skillKey;

    public static SkillTraitSkillRow of(UUID skillSetRevisionId, TraitCode traitCode, String skillKey) {
        var row = new SkillTraitSkillRow();
        row.skillSetRevisionId = skillSetRevisionId;
        row.traitCode = traitCode;
        row.skillKey = skillKey;
        return row;
    }

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, traitCode, skillKey);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID skillSetRevisionId;
        public TraitCode traitCode;
        public String skillKey;
    }
}
