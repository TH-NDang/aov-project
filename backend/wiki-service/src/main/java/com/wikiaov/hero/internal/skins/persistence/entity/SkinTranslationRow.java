package com.wikiaov.hero.internal.skins.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_skin_translation")
@IdClass(SkinTranslationRow.Key.class)
public class SkinTranslationRow extends AssignedIdentifierEntity<SkinTranslationRow.Key> {
    @Id
    private UUID skinSetRevisionId;

    @Id
    private String skinKey;

    @Id
    private String locale;

    private String name;

    private String description;

    private String acquisitionNote;

    @Override
    public Key getId() {
        return new Key(skinSetRevisionId, skinKey, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skinSetRevisionId;
        public String skinKey;
        public String locale;
    }
}
