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

/**
 * A trait a skill set revision has (ADR-029). Rows are written once with their revision and never change, so there is
 * no version: a database trigger refuses any change once the revision is published.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(schema = "hero", name = "hero_skill_trait")
@IdClass(SkillTraitRow.Key.class)
public class SkillTraitRow extends AssignedIdentifierEntity<SkillTraitRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    @Id
    @Enumerated(EnumType.STRING)
    private TraitCode traitCode;

    public static SkillTraitRow of(UUID skillSetRevisionId, TraitCode traitCode) {
        var row = new SkillTraitRow();
        row.skillSetRevisionId = skillSetRevisionId;
        row.traitCode = traitCode;
        return row;
    }

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, traitCode);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID skillSetRevisionId;
        public TraitCode traitCode;
    }
}
