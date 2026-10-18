package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.Immutable;

@Entity
@Getter
@Immutable
@IdClass(HeroPatchChangeTranslation.Key.class)
@Table(schema = "hero", name = "hero_patch_change_translation")
public class HeroPatchChangeTranslation {
    @Id
    private UUID changeSetId;
    @Id
    private String locale;
    private String summary;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID changeSetId;
        public String locale;
    }
}
