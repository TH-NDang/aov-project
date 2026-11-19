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

/** How a trait shows in one locale (ADR-029). Written once with its revision, like {@link SkillTraitRow}. */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(schema = "hero", name = "hero_skill_trait_translation")
@IdClass(SkillTraitTranslationRow.Key.class)
public class SkillTraitTranslationRow extends AssignedIdentifierEntity<SkillTraitTranslationRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    @Id
    @Enumerated(EnumType.STRING)
    private TraitCode traitCode;

    @Id
    private String locale;

    private String detail;

    public static SkillTraitTranslationRow of(UUID skillSetRevisionId, TraitCode traitCode, String locale,
            String detail) {
        var row = new SkillTraitTranslationRow();
        row.skillSetRevisionId = skillSetRevisionId;
        row.traitCode = traitCode;
        row.locale = locale;
        row.detail = detail;
        return row;
    }

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, traitCode, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID skillSetRevisionId;
        public TraitCode traitCode;
        public String locale;
    }
}
