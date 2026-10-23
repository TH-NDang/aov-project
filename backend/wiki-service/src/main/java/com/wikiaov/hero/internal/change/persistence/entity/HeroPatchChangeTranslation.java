package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

@Entity
@Getter
@Setter
@Immutable
@IdClass(HeroPatchChangeTranslation.Key.class)
@Table(schema = "hero", name = "hero_patch_change_translation")
public class HeroPatchChangeTranslation extends AssignedIdentifierEntity<HeroPatchChangeTranslation.Key> {
    @Id
    private UUID changeSetId;
    @Id
    private String locale;
    private String summary;

    @Override
    @Transient
    public Key getId() {
        return new Key(changeSetId, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID changeSetId;
        public String locale;
    }
}
