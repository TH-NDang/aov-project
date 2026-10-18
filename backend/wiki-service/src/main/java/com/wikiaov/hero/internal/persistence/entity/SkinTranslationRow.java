package com.wikiaov.hero.internal.persistence.entity;

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
public class SkinTranslationRow {
    @Id
    private UUID skinSetRevisionId;

    @Id
    private String skinKey;

    @Id
    private String locale;

    private String name;

    private String description;

    private String acquisitionNote;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skinSetRevisionId;
        public String skinKey;
        public String locale;
    }
}
